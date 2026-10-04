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
      <view class="chips">
        <text
          v-for="v in VAT_RATES"
          :key="v"
          class="chip"
          :class="{ 'chip-active': isRateActive('vatRate', v) }"
          @click="pickRate('vatRate', v)"
        >{{ v }}%</text>
      </view>
      <view class="field">
        <text class="field-label">出口退税率</text>
        <input class="field-input" type="digit" v-model="form.rebateRate" />
        <text class="field-unit">%</text>
      </view>
      <view class="chips">
        <text
          v-for="v in REBATE_RATES"
          :key="v"
          class="chip"
          :class="{ 'chip-active': isRateActive('rebateRate', v) }"
          @click="pickRate('rebateRate', v)"
        >{{ v }}%</text>
      </view>
      <view class="field">
        <text class="field-label">国内费用合计</text>
        <input class="field-input" type="digit" v-model="form.domesticFee" />
        <text class="field-unit">¥</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title">汇率与利润</view>
      <picker mode="selector" :range="currencyRange" :value="currencyIndex" @change="onCurrencyChange">
        <view class="field">
          <text class="field-label">结算币种</text>
          <text class="field-picker">{{ currencyLabel }} ›</text>
        </view>
      </picker>
      <view class="field">
        <text class="field-label">汇率（1 {{ form.currency }} = ? ¥）</text>
        <input class="field-input" type="digit" v-model="form.exchangeRate" @input="onRateInput" />
      </view>
      <view class="fx-bar">
        <text v-if="fxStatus === 'loading'" class="fx-text fx-muted">⏳ 正在获取实时汇率…</text>

        <template v-else-if="fxStatus === 'manual'">
          <text class="fx-text fx-muted">⚪ 手动输入（未使用实时汇率)</text>
          <text class="fx-action" @click="useLiveRate">用实时汇率</text>
        </template>

        <template v-else-if="fxStatus === 'error'">
          <text class="fx-text fx-error">🔴 获取失败：{{ fx.error }}（沿用 1 {{ form.currency }} = {{ rateText }} ¥，请手动确认）</text>
          <text class="fx-action" @click="fetchFx()">重试</text>
        </template>

        <text v-else-if="fxStatus === 'stale'" class="fx-text fx-warn">🟠 实时源不可用，沿用 1 {{ form.currency }} = {{ rateText }} ¥（请自行确认）</text>

        <template v-else-if="fxStatus === 'success'">
          <text class="fx-text fx-ok">🟢 实时 1 {{ form.currency }} = {{ rateText }} ¥<text :class="fxChangeClass">{{ fxChangeText }}</text> · 数据日 {{ fxSourceDateShort }} · {{ fx.data.source }}</text>
          <text class="fx-action" @click="fetchFx({ force: true })">刷新</text>
        </template>
      </view>
      <!-- 部分小币种（如卢布）公开汇率源精度有限，必须明说，避免拿去做正式报价 -->
      <view class="fx-bar" v-if="fxStatus === 'success' && fx.data && fx.data.lowPrecision">
        <text class="fx-text fx-warn">⚠️ 该币种公开汇率源精度有限（仅 {{ fx.data.significantDigits }} 位有效数字），正式报价请以银行牌价为准</text>
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
        <text class="field-unit">{{ symbol }}</text>
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
        <text class="result-value">{{ symbol }} {{ fmt(result.fobUnit) }} / 件</text>
      </view>
      <view class="result-line">
        <text class="field-label">FOB 总价</text>
        <text class="result-value">{{ symbol }} {{ fmt(result.fobTotal) }}</text>
      </view>
      <view class="result-line">
        <text class="field-label">CFR 单价</text>
        <text class="result-value">{{ symbol }} {{ fmt(div(result.cfrTotal, result.qty)) }} / 件</text>
      </view>
      <view class="result-line">
        <text class="field-label">CFR 总价</text>
        <text class="result-value">{{ symbol }} {{ fmt(result.cfrTotal) }}</text>
      </view>
      <view class="result-line">
        <text class="field-label">CIF 单价</text>
        <text class="result-value">{{ symbol }} {{ fmt(div(result.cifTotal, result.qty)) }} / 件</text>
      </view>
      <view class="result-line">
        <text class="field-label">CIF 总价</text>
        <text class="result-value">{{ symbol }} {{ fmt(result.cifTotal) }}</text>
      </view>
      <view class="result-line">
        <text class="field-label">保险费</text>
        <text class="result-value">{{ symbol }} {{ fmt(result.insurance) }}</text>
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
        <text class="field-label">换汇成本（汇率 {{ rateText }}）</text>
        <text class="result-value" :class="result.isProfit ? 'profit' : result.isLoss ? 'loss' : ''">
          {{ fmt(result.exchangeCost, rateDecimals(result.exchangeCost)) }}
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
      <view class="row">
        <view class="btn" @click="onSave">保存到记录</view>
        <view class="btn btn-ghost" @click="onCopyQuote">复制报价文本</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, computed, onMounted, watch } from 'vue'
import { calcQuote, formatNumber, safeNumber } from '../../utils/calc.js'
import { saveRecord, makeId, saveForm, loadForm } from '../../utils/storage.js'
import { getFxRate } from '../../utils/request.js'
import { CURRENCIES, getCurrency, rateDecimals } from '../../utils/currency.js'

// 表单默认值（与 SPEC 一致）
const form = reactive({
  productName: '',
  customerName: '',
  price: 100,
  qty: 1000,
  vatRate: 13,
  rebateRate: 13,
  domesticFee: 2000,
  currency: 'USD',
  exchangeRate: 7.1,
  profitRate: 10,
  freight: 500,
  insuranceRate: 0.3,
  markupRate: 10,
})

const result = computed(() => calcQuote(form))

// ---- 结算币种：picker 选项与当前项 ----
const currencyRange = CURRENCIES.map((c) => `${c.name}（${c.code}）`)
const currencyIndex = computed(() => {
  const i = CURRENCIES.findIndex((c) => c.code === form.currency)
  return i === -1 ? 0 : i
})
const currencyLabel = computed(() => {
  const c = getCurrency(form.currency)
  return `${c.name}（${c.code}）`
})
// 报价金额使用的币种符号（$ / € / ¥ / A$ / ₫ …）
const symbol = computed(() => getCurrency(form.currency).symbol)

// ---- 表单记忆：只记稳定字段，产品名/客户名/汇率不记 ----
const MEMO_KEYS = [
  'price',
  'qty',
  'vatRate',
  'rebateRate',
  'domesticFee',
  'currency',
  'profitRate',
  'freight',
  'insuranceRate',
  'markupRate',
]

watch(
  form,
  () => {
    const payload = {}
    MEMO_KEYS.forEach((k) => {
      payload[k] = form[k]
    })
    saveForm('quote', payload)
  },
  { deep: true },
)

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

// ---- 实时汇率：进入页面自动获取，手动可覆盖 ----
const fx = reactive({
  loading: false,
  manual: false, // 用户手动改过汇率，自动刷新不再覆盖
  data: null, // 最近一次成功的返回对象
  error: '', // 最近一次失败的 message
})

// 展示状态：手动优先，其次加载 / 失败 / 数据（成功或 stale）
const fxStatus = computed(() => {
  if (fx.manual) return 'manual'
  if (fx.loading) return 'loading'
  if (fx.error) return 'error'
  if (fx.data) return fx.data.stale ? 'stale' : 'success'
  return 'idle'
})

// 状态栏展示的汇率取当前输入框的值（成功/stale 已同步写入，失败时即用户现有值）
// 位数按量级自适应：小面值币种（VND/IDR 等）多给几位，避免显示成 0.0000
const rateText = computed(() => fmt(form.exchangeRate, rateDecimals(form.exchangeRate)))

const fxChangePct = computed(() => {
  const v = fx.data && fx.data.changePct
  return v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v)
})

const fxChangeText = computed(() => {
  const p = fxChangePct.value
  if (p === null) return ''
  const arrow = p > 0 ? '↑' : p < 0 ? '↓' : ''
  return arrow + formatNumber(Math.abs(p), 3) + '%'
})

// change > 0 用红色（人民币贬值）、change < 0 用绿色；changePct 为 null 时不显示
const fxChangeClass = computed(() => {
  if (fxChangePct.value === null) return ''
  const c = fx.data && fx.data.change
  const signed = Number.isFinite(Number(c)) ? Number(c) : fxChangePct.value
  if (signed > 0) return 'fx-up'
  if (signed < 0) return 'fx-down'
  return ''
})

// "2026-10-02" → "10-02"
function shortDate(s) {
  const m = s && String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? m[2] + '-' + m[3] : s || ''
}
const fxSourceDateShort = computed(() => shortDate(fx.data && fx.data.sourceDate))

// 拉取实时汇率；手动模式下不覆盖用户输入
async function fetchFx({ force = false } = {}) {
  if (fx.manual) return
  fx.loading = true
  fx.error = ''
  const from = form.currency
  try {
    const data = await getFxRate({ from, to: 'CNY', force })
    // 币种可能在请求期间又被切走，过期结果直接丢弃
    if (from !== form.currency) return
    fx.data = data
    // 存全精度原始值：小面值币种（VND 0.000258 等）截断会带来巨大误差
    if (!fx.manual) form.exchangeRate = Number(data.rate)
  } catch (e) {
    if (from !== form.currency) return
    fx.error = (e && e.message) || '网络请求失败'
  } finally {
    if (from === form.currency) fx.loading = false
  }
}

// 切换结算币种：立即按新币种强制重拉，并退出手动模式回到自动
function onCurrencyChange(e) {
  const idx = Number(e.detail.value)
  const picked = CURRENCIES[idx]
  if (!picked || picked.code === form.currency) return
  form.currency = picked.code
  fx.manual = false
  fx.data = null
  fetchFx({ force: true })
}

// 用户开始手动输入 → 切到手动模式
function onRateInput() {
  fx.manual = true
}

// 点「用实时汇率」→ 退出手动模式并重新拉取覆盖
function useLiveRate() {
  fx.manual = false
  fetchFx()
}

// 常用税率一键选（点击直接填入，当前值高亮）
const VAT_RATES = [13, 9, 6]
const REBATE_RATES = [13, 10, 9, 6, 0]

function pickRate(field, v) {
  form[field] = v
}
function isRateActive(field, v) {
  return Number(form[field]) === v
}

onMounted(() => {
  const saved = loadForm('quote')
  if (saved) {
    MEMO_KEYS.forEach((k) => {
      if (saved[k] !== undefined && saved[k] !== null) form[k] = saved[k]
    })
    // 记忆里的币种可能已失效，回退 USD
    form.currency = getCurrency(form.currency).code
  }
  fetchFx()
})

function onSave() {
  const r = result.value
  const record = {
    id: makeId(),
    productName: form.productName || '未命名产品',
    customerName: form.customerName || '',
    currency: form.currency,
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

function onCopyQuote() {
  const r = result.value
  const code = form.currency
  const productName = form.productName || '未命名产品'
  const customerName = form.customerName || '未填写客户'
  // 外贸单据统一用币种代码，避免 ¥ / $ 符号歧义
  const text = [
    `【报价单】${productName} - ${customerName}`,
    `币种：${code}`,
    `FOB 上海：${code} ${fmt(r.fobUnit)}/件（总价 ${code} ${fmt(r.fobTotal)}）`,
    `CFR：${code} ${fmt(div(r.cfrTotal, r.qty))}/件（总价 ${code} ${fmt(r.cfrTotal)}）`,
    `CIF：${code} ${fmt(div(r.cifTotal, r.qty))}/件（总价 ${code} ${fmt(r.cifTotal)}）`,
    `数量：${fmt(r.qty, 0)} 件 | 汇率：1 ${code} = ${rateText.value} ¥ | 盈亏率：${fmt(r.profitPct, 2)}%`,
    '有效期：30 天',
  ].join('\n')
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'success' }),
  })
}
</script>

<style scoped>
/* 币种选择：picker 包裹的 field 需要补回底部分隔线 */
picker .field {
  border-bottom: 1rpx solid #f0f1f3;
}
.field-picker {
  color: #111827;
  font-size: 28rpx;
}

/* 常用税率 chips */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 12rpx 0 8rpx;
}
.chip {
  font-size: 24rpx;
  line-height: 1;
  color: #2563eb;
  background: #eff6ff;
  border: 1rpx solid #bfdbfe;
  border-radius: 999rpx;
  padding: 12rpx 24rpx;
}
.chip-active {
  color: #ffffff;
  background: #2563eb;
  border-color: #2563eb;
}

/* 汇率状态栏：紧贴汇率输入框的小字提示 */
.fx-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 8rpx 0 16rpx;
}
.fx-text {
  flex: 1;
  font-size: 22rpx;
  line-height: 1.5;
  color: #4b5563;
}
.fx-action {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #2563eb;
  padding: 4rpx 14rpx;
  border: 1rpx solid #bfdbfe;
  border-radius: 8rpx;
}
.fx-muted {
  color: #9ca3af;
}
.fx-warn {
  color: #d97706;
}
.fx-error {
  color: #dc2626;
}
.fx-up {
  color: #dc2626;
  margin-left: 6rpx;
}
.fx-down {
  color: #16a34a;
  margin-left: 6rpx;
}
</style>
