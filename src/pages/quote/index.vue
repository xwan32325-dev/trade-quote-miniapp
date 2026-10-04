<!-- 报价计算页：录入成本与费用，实时算出 FOB / CFR / CIF 与换汇成本、盈亏率 -->
<template>
  <view class="page">
    <view class="card">
      <view class="card-title">基础信息</view>
      <view class="field">
        <text class="field-label">产品名称</text>
        <input class="field-input" v-model="form.productName" placeholder="可留空" />
      </view>
      <view class="field">
        <text class="field-label">客户名</text>
        <input class="field-input" v-model="form.customerName" placeholder="可留空" />
      </view>
    </view>

    <view class="card">
      <view class="card-title">成本与费率</view>
      <view class="field">
        <text class="field-label">采购成本（含税）</text>
        <input class="field-input" type="digit" v-model="form.price" />
        <text class="field-unit">¥/件</text>
      </view>
      <view class="field">
        <text class="field-label">数量</text>
        <input class="field-input" type="digit" v-model="form.qty" />
        <text class="field-unit">件</text>
      </view>
      <view class="field">
        <text class="field-label">增值税率</text>
        <input class="field-input" type="digit" v-model="form.vatRate" />
        <text class="field-unit">%</text>
      </view>
      <view class="field">
        <text class="field-label">出口退税率</text>
        <input class="field-input" type="digit" v-model="form.rebateRate" />
        <text class="field-unit">%</text>
      </view>
      <view class="field">
        <text class="field-label">国内费用合计</text>
        <input class="field-input" type="digit" v-model="form.domesticFee" />
        <text class="field-unit">¥</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title">汇率与利润</view>
      <view class="field">
        <text class="field-label">汇率（1 USD = ? ¥）</text>
        <input class="field-input" type="digit" v-model="form.exchangeRate" />
      </view>
      <view class="field">
        <text class="field-label">预期利润率</text>
        <input class="field-input" type="digit" v-model="form.profitRate" />
        <text class="field-unit">%</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title">海运与保险</view>
      <view class="field">
        <text class="field-label">海运费（整票）</text>
        <input class="field-input" type="digit" v-model="form.freight" />
        <text class="field-unit">$</text>
      </view>
      <view class="field">
        <text class="field-label">保险费率</text>
        <input class="field-input" type="digit" v-model="form.insuranceRate" />
        <text class="field-unit">%</text>
      </view>
      <view class="field">
        <text class="field-label">投保加成率</text>
        <input class="field-input" type="digit" v-model="form.markupRate" />
        <text class="field-unit">%</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title">报价结果</view>
      <view class="result-line">
        <text class="field-label">FOB 单价</text>
        <text class="result-value">$ {{ fmt(result.fobUnit) }} / 件</text>
      </view>
      <view class="result-line">
        <text class="field-label">FOB 总价</text>
        <text class="result-value">$ {{ fmt(result.fobTotal) }}</text>
      </view>
      <view class="result-line">
        <text class="field-label">CFR 单价</text>
        <text class="result-value">$ {{ fmt(div(result.cfrTotal, result.qty)) }} / 件</text>
      </view>
      <view class="result-line">
        <text class="field-label">CFR 总价</text>
        <text class="result-value">$ {{ fmt(result.cfrTotal) }}</text>
      </view>
      <view class="result-line">
        <text class="field-label">CIF 单价</text>
        <text class="result-value">$ {{ fmt(div(result.cifTotal, result.qty)) }} / 件</text>
      </view>
      <view class="result-line">
        <text class="field-label">CIF 总价</text>
        <text class="result-value">$ {{ fmt(result.cifTotal) }}</text>
      </view>
      <view class="result-line">
        <text class="field-label">保险费</text>
        <text class="result-value">$ {{ fmt(result.insurance) }}</text>
      </view>
      <view class="result-line">
        <text class="field-label">退税额合计</text>
        <text class="result-value">¥ {{ fmt(result.refundTotal) }}</text>
      </view>
      <view class="result-line">
        <text class="field-label">出口总成本</text>
        <text class="result-value">¥ {{ fmt(result.totalCost) }}</text>
      </view>
      <view class="result-line">
        <text class="field-label">换汇成本（汇率 {{ fmt(form.exchangeRate, 4) }}）</text>
        <text class="result-value" :class="result.isProfit ? 'profit' : result.isLoss ? 'loss' : ''">
          {{ fmt(result.exchangeCost, 4) }}
          <text v-if="result.isProfit"> 盈利</text>
          <text v-else-if="result.isLoss"> 亏损</text>
        </text>
      </view>
      <view class="result-line">
        <text class="field-label">盈亏率</text>
        <text class="result-value" :class="result.profitPct >= 0 ? 'profit' : 'loss'">
          {{ fmt(result.profitPct, 2) }}%
        </text>
      </view>
    </view>

    <view class="card">
      <view class="btn" @click="onSave">保存到记录</view>
    </view>
  </view>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { calcQuote, formatNumber, safeNumber } from '../../utils/calc.js'
import { saveRecord, makeId } from '../../utils/storage.js'

// 表单默认值（与 SPEC 一致）
const form = reactive({
  productName: '',
  customerName: '',
  price: 100,
  qty: 1000,
  vatRate: 13,
  rebateRate: 13,
  domesticFee: 2000,
  exchangeRate: 7.1,
  profitRate: 10,
  freight: 500,
  insuranceRate: 0.3,
  markupRate: 10,
})

const result = computed(() => calcQuote(form))

// 展示用格式化：金额 2 位、汇率/换汇成本 4 位，均带千分位
function fmt(v, decimals = 2) {
  return formatNumber(v, decimals)
}

// CFR / CIF 单价由总价除以数量得出；数量为 0 时返回 0
function div(a, b) {
  const n = safeNumber(b)
  if (!n) return 0
  const r = safeNumber(a) / n
  return Number.isFinite(r) ? r : 0
}

function onSave() {
  const r = result.value
  const record = {
    id: makeId(),
    productName: form.productName || '未命名产品',
    customerName: form.customerName || '',
    term: 'FOB',
    unitPrice: r.fobUnit,
    totalPrice: r.fobTotal,
    createdAt: Date.now(),
    input: { ...form },
    result: { ...r },
  }
  saveRecord(record)
  uni.showToast({ title: '已保存', icon: 'success' })
}
</script>
