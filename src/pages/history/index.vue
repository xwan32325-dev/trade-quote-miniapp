<!-- 我的记录页：查看历史报价，支持展开详情、删除单条、清空全部 -->
<template>
  <view class="page">
    <view class="card" v-if="list.length">
      <view class="row">
        <view class="btn btn-danger" @click="onClear">清空全部</view>
      </view>
    </view>

    <view class="card" v-if="!list.length">
      <view class="empty">还没有保存的报价记录</view>
      <view class="muted" style="text-align: center">到「报价」页填入参数并点击「保存到记录」即可。</view>
    </view>

    <view class="card" v-for="item in list" :key="item.id">
      <view @click="toggle(item.id)">
        <view class="record-head">
          <text class="record-title">{{ item.productName }}</text>
          <text class="muted">{{ formatTime(item.createdAt) }}</text>
        </view>
        <view class="muted" v-if="item.customerName">客户：{{ item.customerName }}</view>
        <view class="muted">运输方式：{{ transportText(item) }}</view>
        <view class="record-summary">
          <text>{{ termOf(item) }} 单价 {{ codeOf(item) }} {{ fmt(item.unitPrice) }}</text>
          <text>总价 {{ codeOf(item) }} {{ fmt(item.totalPrice) }}</text>
        </view>
      </view>

      <view class="detail" v-if="expandedId === item.id">
        <view class="result-line">
          <text class="field-label">贸易方式</text>
          <text class="result-value">{{ termLabel(termOf(item)) }}</text>
        </view>
        <view class="result-line">
          <text class="field-label">{{ termOf(item) }} 单价</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.unitPrice) }} / 件</text>
        </view>
        <view class="result-line">
          <text class="field-label">{{ termOf(item) }} 总价</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.totalPrice) }}</text>
        </view>
        <view class="result-line">
          <text class="field-label">货值成本</text>
          <text class="result-value">¥ {{ fmt(costBaseOf(item)) }}</text>
        </view>
        <view class="result-line" v-if="includesOf(item).carriage">
          <text class="field-label">运费</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.result.freight) }}</text>
        </view>
        <view class="result-line" v-if="includesOf(item).insurance">
          <text class="field-label">保险费</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.result.insurance) }}</text>
        </view>
        <view class="result-line" v-if="includesOf(item).destination">
          <text class="field-label">目的地费用</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.result.destinationFee) }}</text>
        </view>
        <view class="result-line" v-if="includesOf(item).duty">
          <text class="field-label">进口关税</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.result.tariff) }}</text>
        </view>
        <view class="result-line" v-if="includesOf(item).duty">
          <text class="field-label">进口增值税</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.result.importVat) }}</text>
        </view>
        <view class="result-line">
          <text class="field-label">换汇成本（按 FOB 口径）</text>
          <text class="result-value">{{ fmt(item.result.exchangeCost, 4) }}</text>
        </view>
        <view class="result-line">
          <text class="field-label">盈亏率</text>
          <text class="result-value">{{ fmt(item.result.profitPct) }}%</text>
        </view>
        <view class="muted" style="margin-top: 12rpx">
          输入：{{ item.input.price }} 元/件 · {{ item.input.qty }} 件 · 汇率 {{ item.input.exchangeRate }} · 利润率 {{ item.input.profitRate }}%
        </view>
        <view class="row" style="margin-top: 20rpx">
          <view class="btn btn-danger" @click.stop="onDelete(item.id)">删除这条</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getHistory, removeRecord, clearHistory } from '../../utils/storage.js'
import { formatNumber } from '../../utils/calc.js'
import { getCurrency } from '../../utils/currency.js'
import { MULTIMODAL, modeShortName } from '../../utils/transport.js'
import { termLabel, termIncludes } from '../../utils/incoterms.js'

const list = ref([])
const expandedId = ref('')

function load() {
  list.value = getHistory()
}

// 每次进入页面刷新，保证新保存的记录可见
onShow(load)

function fmt(v, decimals = 2) {
  return formatNumber(v, decimals)
}

// 旧记录没有 currency 字段，按 USD 兜底
function codeOf(item) {
  return getCurrency(item && item.currency).code
}

// 运输方式展示：多式联运带组合，其余用简称；旧记录缺字段回退「海运整柜」
function transportText(item) {
  const code = item && item.transportMode
  if (code === MULTIMODAL.code) {
    const parts = (Array.isArray(item.multimodal) ? item.multimodal : []).map(modeShortName)
    return parts.length ? `${MULTIMODAL.name}（${parts.join(' + ')}）` : MULTIMODAL.name
  }
  return modeShortName(code)
}

// 贸易术语：优先 tradeTerm，旧记录按原 term 字段兜底，再兜底 FOB
function termOf(item) {
  return (item && (item.tradeTerm || item.term)) || 'FOB'
}

// 该记录术语计入哪些费用项（旧记录无 includes 字段时按术语表推导）
function includesOf(item) {
  return termIncludes(termOf(item))
}

// 货值成本：新记录有 costBase；旧记录没有则退回 totalCost（含国内成本）
function costBaseOf(item) {
  const r = (item && item.result) || {}
  return r.costBase !== undefined ? r.costBase : r.totalCost
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n) => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function toggle(id) {
  expandedId.value = expandedId.value === id ? '' : id
}

function onDelete(id) {
  uni.showModal({
    title: '删除记录',
    content: '确定删除这条报价记录吗？',
    success: (res) => {
      if (res.confirm) {
        removeRecord(id)
        load()
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    },
  })
}

function onClear() {
  uni.showModal({
    title: '清空全部',
    content: '确定清空所有报价记录吗？此操作不可恢复。',
    success: (res) => {
      if (res.confirm) {
        clearHistory()
        load()
        uni.showToast({ title: '已清空', icon: 'success' })
      }
    },
  })
}
</script>

<style scoped>
.empty {
  text-align: center;
  font-size: 30rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}
.record-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.record-title {
  font-size: 30rpx;
  font-weight: 600;
}
.record-summary {
  display: flex;
  justify-content: space-between;
  margin-top: 12rpx;
  color: #2563eb;
  font-size: 28rpx;
}
.detail {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f1f3;
}
</style>
