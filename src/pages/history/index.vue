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
          <text>{{ codeOf(item) }} 单价 {{ fmt(item.unitPrice) }}</text>
          <text>总价 {{ codeOf(item) }} {{ fmt(item.totalPrice) }}</text>
        </view>
      </view>

      <view class="detail" v-if="expandedId === item.id">
        <view class="result-line">
          <text class="field-label">退税额合计</text>
          <text class="result-value">¥ {{ fmt(item.result.refundTotal) }}</text>
        </view>
        <view class="result-line">
          <text class="field-label">出口总成本</text>
          <text class="result-value">¥ {{ fmt(item.result.totalCost) }}</text>
        </view>
        <view class="result-line">
          <text class="field-label">{{ termsOf(item).base }} 总价</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.result.fobTotal) }}</text>
        </view>
        <view class="result-line">
          <text class="field-label">{{ termsOf(item).freight }} 总价</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.result.cfrTotal) }}</text>
        </view>
        <view class="result-line">
          <text class="field-label">{{ termsOf(item).insured }} 总价</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.result.cifTotal) }}</text>
        </view>
        <view class="result-line">
          <text class="field-label">保险费</text>
          <text class="result-value">{{ codeOf(item) }} {{ fmt(item.result.insurance) }}</text>
        </view>
        <view class="result-line">
          <text class="field-label">换汇成本</text>
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
import { MULTIMODAL, modeShortName, termNames } from '../../utils/transport.js'

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

// 贸易术语随运输方式切换：海运类 FOB/CFR/CIF，其余 FCA/CPT/CIP（旧记录按海运兜底）
function termsOf(item) {
  return termNames((item && item.transportMode) || 'SEA_FCL')
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
