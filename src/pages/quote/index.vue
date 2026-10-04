<!-- 报价计算页：录入运输方式、贸易术语、成本与费用，实时算出所选术语的单价/总价与换汇成本、盈亏率 -->
<template>
  <view class="page">
    <view class="card">
      <view class="card-title">拍照填单</view>
      <view class="ocr-btn" :class="{ 'ocr-btn-disabled': ocr.loading }" @click="onOcr">
        {{ ocr.loading ? '识别中…' : '📷 拍照填单' }}
      </view>
      <view class="ocr-hint">拍采购单 / 发票 / 装箱单，自动识别产品、数量、单价、箱规</view>
      <view class="ocr-thumb-wrap" v-if="ocr.thumb">
        <image class="ocr-thumb" :src="ocr.thumb" mode="aspectFill" />
        <text v-if="ocr.loading" class="ocr-thumb-tip">识别中…</text>
      </view>
      <view class="ocr-error" v-if="ocr.error">{{ ocr.error }}</view>
      <view class="ocr-result" v-if="ocr.filled.length || ocr.missing.length || ocr.notes">
        <view class="ocr-ok" v-if="ocr.filled.length">✅ 已填入：{{ ocr.filled.join('、') }}</view>
        <view class="ocr-miss" v-if="ocr.missing.length">未识别到：{{ ocr.missing.join('、') }}</view>
        <view class="ocr-note" v-if="ocr.notes">单据备注：{{ ocr.notes }}</view>
        <view class="ocr-sync" v-if="ocr.cartonSynced">箱规已同步到装柜页</view>
      </view>
    </view>

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
        <text class="field-label">报关费</text>
        <input class="field-input" type="digit" v-model="form.feeCustoms" />
        <text class="field-unit">¥</text>
      </view>
      <view class="field">
        <text class="field-label">拖车费（工厂→港口）</text>
        <input class="field-input" type="digit" v-model="form.feeTrucking" />
        <text class="field-unit">¥</text>
      </view>
      <view class="field">
        <text class="field-label">港杂费（THC/港口操作）</text>
        <input class="field-input" type="digit" v-model="form.feePort" />
        <text class="field-unit">¥</text>
      </view>
      <view class="field">
        <text class="field-label">单证费（产地证/商检/认证）</text>
        <input class="field-input" type="digit" v-model="form.feeDocs" />
        <text class="field-unit">¥</text>
      </view>
      <view class="field">
        <text class="field-label">银行费用（结汇/信用证）</text>
        <input class="field-input" type="digit" v-model="form.feeBank" />
        <text class="field-unit">¥</text>
      </view>
      <view class="field">
        <text class="field-label">仓储费（仓库/装柜）</text>
        <input class="field-input" type="digit" v-model="form.feeWarehouse" />
        <text class="field-unit">¥</text>
      </view>
      <view class="field">
        <text class="field-label">其他费用</text>
        <input class="field-input" type="digit" v-model="form.feeOther" />
        <text class="field-unit">¥</text>
      </view>
      <view class="field">
        <text class="field-label">国内费用合计</text>
        <input class="field-input field-input-readonly" :value="fmt(domesticFeeTotal)" disabled />
        <text class="field-unit">¥</text>
      </view>
      <view class="fee-hint">按实际发生额填写；没有的项目填 0</view>
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
        <text class="field-label">预期利润率<text v-if="manualActive" class="label-note">（手动定价时不生效）</text></text>
        <input class="field-input" type="digit" v-model="form.profitRate" />
        <text class="field-unit">%</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title">运输方式</view>
      <picker mode="selector" :range="transportRange" :value="transportIndex" @change="onTransportChange">
        <view class="field">
          <text class="field-label">运输方式</text>
          <text class="field-picker">{{ transportLabel }} ›</text>
        </view>
      </picker>
      <picker mode="selector" :range="termRange" :value="termIndex" @change="onTermChange">
        <view class="field">
          <text class="field-label">贸易方式</text>
          <text class="field-picker">{{ termLabelText }} ›</text>
        </view>
      </picker>
      <view class="term-note">FAS/FOB/FCA 共用同一基准价；如需体现装船费差异，请在国内费用里自行增减</view>
      <view class="term-note" v-if="form.tradeTerm === 'DPU'">DPU 的卸货费含在「目的地费用」里</view>
      <template v-if="isMultimodal">
        <view class="multi-hint">从下列 11 种方式中勾选实际组合（至少 2 种）</view>
        <view class="chips">
          <text
            v-for="m in TRANSPORT_MODES"
            :key="m.code"
            class="chip"
            :class="{ 'chip-active': isMultiActive(m.code) }"
            @click="toggleMulti(m.code)"
          >{{ m.name }}</text>
        </view>
        <view class="multi-summary">已选组合：{{ multiText || '—' }}</view>
        <view class="multi-warn" v-if="form.multimodal.length < 2">⚠️ 多式联运至少选 2 种</view>
      </template>
    </view>

    <view class="card">
      <view class="card-title">{{ isSeaMode(form.transportMode) ? '海运与保险' : '运费与保险' }}</view>
      <view class="field">
        <text class="field-label">{{ freightLabelText }}</text>
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
      <view class="field">
        <text class="field-label">目的地费用（整票）</text>
        <input class="field-input" type="digit" v-model="form.destinationFee" />
        <text class="field-unit">{{ symbol }}</text>
      </view>
      <view class="field">
        <text class="field-label">进口关税税率</text>
        <input class="field-input" type="digit" v-model="form.tariffRate" />
        <text class="field-unit">%</text>
      </view>
      <view class="field">
        <text class="field-label">目的国增值税率</text>
        <input class="field-input" type="digit" v-model="form.importVatRate" />
        <text class="field-unit">%</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title">报价结果</view>
      <view class="result-line">
        <text class="field-label">贸易方式</text>
        <text class="result-value">{{ termLabelText }}</text>
      </view>
      <view class="result-line result-line-edit">
        <text class="field-label">{{ result.tradeTerm }} 单价</text>
        <view class="unit-edit">
          <input
            class="unit-input"
            :class="{ 'unit-input-on': manualActive, 'unit-low': view.belowCost }"
            type="digit"
            :value="unitInputText"
            @input="onUnitInput"
          />
          <text class="unit-unit">{{ symbol }} / 件</text>
          <text v-if="manualActive" class="manual-tag">手动</text>
          <text v-if="manualActive" class="manual-restore" @click="restoreAutoPrice">恢复按成本计算</text>
        </view>
      </view>
      <view class="result-line">
        <text class="field-label">{{ result.tradeTerm }} 总价</text>
        <text class="result-value result-main" :class="{ low: view.belowCost }">{{ symbol }} {{ fmt(view.totalPrice) }}</text>
      </view>
      <view class="dash"></view>
      <view class="result-line">
        <text class="field-label">{{ costBaseLabel }}</text>
        <text class="result-value">¥ {{ fmt(result.costBase) }}</text>
      </view>
      <view class="result-line" v-if="counts.domestic">
        <text class="field-label">国内费用合计</text>
        <text class="result-value">¥ {{ fmt(domesticFeeTotal) }}</text>
      </view>
      <view class="result-line" v-if="result.includesFreight">
        <text class="field-label">运费</text>
        <text class="result-value">{{ symbol }} {{ fmt(view.freight) }}</text>
      </view>
      <view class="result-line" v-if="result.includesInsurance">
        <text class="field-label">保险费</text>
        <text class="result-value">{{ symbol }} {{ fmt(view.insurance) }}</text>
      </view>
      <view class="result-line" v-if="result.includesDestination">
        <text class="field-label">目的地费用</text>
        <text class="result-value">{{ symbol }} {{ fmt(view.destinationFee) }}</text>
      </view>
      <view class="result-line" v-if="result.includesDuty">
        <text class="field-label">进口关税</text>
        <text class="result-value">{{ symbol }} {{ fmt(view.tariff) }}</text>
      </view>
      <view class="result-line" v-if="result.includesDuty">
        <text class="field-label">进口增值税</text>
        <text class="result-value">{{ symbol }} {{ fmt(view.importVat) }}</text>
      </view>
      <view class="result-line" v-if="manualActive">
        <text class="field-label">成本加成率</text>
        <text class="result-value" :class="view.belowCost ? 'low' : 'profit'">{{ fmt(view.markupPct, 2) }}%</text>
      </view>
      <view class="result-line">
        <text class="field-label">换汇成本（按 FOB 口径）</text>
        <text class="result-value" :class="view.isProfit ? 'profit' : view.isLoss ? 'loss' : ''">
          {{ fmt(view.exchangeCost, rateDecimals(view.exchangeCost)) }}
          <text v-if="view.isProfit"> 盈利</text>
          <text v-else-if="view.isLoss"> 亏损</text>
        </text>
      </view>
      <view class="result-line">
        <text class="field-label">盈亏率</text>
        <text class="result-value" :class="view.profitPct >= 0 ? 'profit' : 'loss'">
          {{ fmt(view.profitPct, 2) }}%
        </text>
      </view>
      <view class="result-line" v-if="view.belowCost">
        <text class="field-label low">低于成本</text>
        <text class="result-value low">{{ symbol }} {{ fmt(view.shortfall) }}</text>
      </view>
      <view class="result-note" v-if="uncountedText">未计入本次报价：{{ uncountedText }}</view>
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
import { formatNumber, safeNumber } from '../../utils/calc.js'
import { saveRecord, makeId, saveForm, loadForm } from '../../utils/storage.js'
import { getFxRate, parseImage } from '../../utils/request.js'
import { pickImageAsDataUrl } from '../../utils/image.js'
import { CURRENCIES, getCurrency, rateDecimals } from '../../utils/currency.js'
import {
  TRANSPORT_MODES,
  MODE_OPTIONS,
  MULTIMODAL,
  getMode,
  isSeaMode,
  freightLabel,
  modeShortName,
} from '../../utils/transport.js'
import {
  calcTermQuote,
  calcManualTermQuote,
  termsForMode,
  defaultTerm,
  remapTerm,
  isValidTerm,
  termLabel,
} from '../../utils/incoterms.js'

// 表单默认值（与 SPEC 一致）；贸易术语默认取当前运输方式的默认值（海运 FOB）
const form = reactive({
  productName: '',
  customerName: '',
  price: 100,
  qty: 1000,
  vatRate: 13,
  rebateRate: 13,
  // 国内费用 7 项明细（整票 ¥）；默认合计 2000（报关 500 + 拖车 800 + 港杂 500 + 单证 200），
  // 可选项（银行/仓储/其他）默认 0，避免无此支出时凭空多出成本
  feeCustoms: 500,
  feeTrucking: 800,
  feePort: 500,
  feeDocs: 200,
  feeBank: 0,
  feeWarehouse: 0,
  feeOther: 0,
  currency: 'USD',
  exchangeRate: 7.1,
  profitRate: 10,
  transportMode: TRANSPORT_MODES[0].code,
  tradeTerm: defaultTerm(TRANSPORT_MODES[0].code),
  multimodal: [],
  freight: 500,
  insuranceRate: 0.3,
  markupRate: 10,
  destinationFee: 0,
  tariffRate: 5,
  importVatRate: 13,
  manualUnitPrice: '', // 手动单价（空串 = 按成本计算）
})

// ---- 国内费用：7 项明细累加为合计，再作为单一 domesticFee 送入计算 ----
const FEE_KEYS = [
  'feeCustoms',
  'feeTrucking',
  'feePort',
  'feeDocs',
  'feeBank',
  'feeWarehouse',
  'feeOther',
]
const domesticFeeTotal = computed(() => FEE_KEYS.reduce((sum, k) => sum + safeNumber(form[k]), 0))
// 计算输入：在原表单上补一个 domesticFee（7 项合计），公式与外部接口保持不变
const calcInput = computed(() => ({ ...form, domesticFee: domesticFeeTotal.value }))
const result = computed(() => calcTermQuote(calcInput.value))

// ---- 手动定价状态机：manualUnitPrice 非空即进入手动定价 ----
const manualActive = computed(
  () => form.manualUnitPrice !== '' && form.manualUnitPrice !== null && form.manualUnitPrice !== undefined,
)
// 手动模式的反算结果（成本加成率 / FOB 净收入口径的换汇成本、盈亏率）
const manualResult = computed(() => calcManualTermQuote(calcInput.value, form.manualUnitPrice))
// 单价输入框显示值：手动时显示输入原值，否则显示按成本算出的单价（2 位小数）
const unitInputText = computed(() =>
  manualActive.value ? String(form.manualUnitPrice) : safeNumber(result.value.unitPrice).toFixed(2),
)
function onUnitInput(e) {
  form.manualUnitPrice = e.detail.value
}
// 点「恢复按成本计算」→ 清空手动价回到计算值
function restoreAutoPrice() {
  form.manualUnitPrice = ''
}

// 结果区展示口径：手动定价时总价/保险费/换汇成本/盈亏率改用反算值，其余照旧
const view = computed(() => {
  const r = result.value
  if (!manualActive.value) {
    return {
      manual: false,
      unitPrice: r.unitPrice,
      totalPrice: r.totalPrice,
      freight: r.freight,
      insurance: r.insurance,
      destinationFee: r.destinationFee,
      tariff: r.tariff,
      importVat: r.importVat,
      exchangeCost: r.exchangeCost,
      profitPct: r.profitPct,
      isProfit: r.isProfit,
      isLoss: r.isLoss,
      markupPct: null,
      belowCost: false,
      shortfall: 0,
    }
  }
  const m = manualResult.value
  return {
    manual: true,
    unitPrice: m.manualUnit,
    totalPrice: m.manualTotal,
    freight: m.freight,
    insurance: m.insurance, // 保险费按手动总价计
    destinationFee: m.destinationFee,
    tariff: m.tariff,
    importVat: m.importVat,
    exchangeCost: m.exchangeCost,
    profitPct: m.profitPct,
    isProfit: m.isProfit,
    isLoss: m.isLoss,
    markupPct: m.markupPct,
    belowCost: m.belowCost,
    shortfall: m.shortfall,
  }
})

// 成本口径随术语变化：EXW 不含国内出口费用，其余术语含
const costBaseLabel = computed(() =>
  form.tradeTerm === 'EXW' ? '出厂成本（不含国内出口费用）' : '出口成本（含国内费用）',
)

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

// ---- 运输方式：11 种单选 + 多式联运多选 ----
const transportRange = MODE_OPTIONS.map((m) => m.name)
const transportIndex = computed(() => {
  const i = MODE_OPTIONS.findIndex((m) => m.code === form.transportMode)
  return i === -1 ? 0 : i
})
const transportLabel = computed(() => getMode(form.transportMode).name)
const isMultimodal = computed(() => form.transportMode === MULTIMODAL.code)
// 贸易术语：按当前运输方式过滤（海运 11 种，其余 7 种），默认海运 FOB / 其余 FCA
const termRange = computed(() => termsForMode(form.transportMode).map((t) => `${t.code}（${t.zh}）`))
const termIndex = computed(() => {
  const i = termsForMode(form.transportMode).findIndex((t) => t.code === form.tradeTerm)
  return i === -1 ? 0 : i
})
const termLabelText = computed(() => termLabel(form.tradeTerm))
const freightLabelText = computed(() => freightLabel(form.transportMode))
// 多式联运已选组合（简称拼接，如「海运整柜 + 铁路运输」）
const multiText = computed(() => form.multimodal.map(modeShortName).join(' + '))

// 各费用项是否计入当前术语（决定输入标签的「本术语不计入」小字与结果明细）
const counts = computed(() => ({
  freight: result.value.includesFreight,
  insurance: result.value.includesInsurance,
  destination: result.value.includesDestination,
  duty: result.value.includesDuty,
  domestic: result.value.includesDomestic,
}))
// 结果区灰色提示：本术语未计入的费用项（避免用户以为填了没用）
const uncountedText = computed(() => {
  const c = counts.value
  const names = []
  if (!c.domestic) names.push('国内费用合计')
  if (!c.freight) names.push('运费')
  if (!c.insurance) names.push('保险费')
  if (!c.destination) names.push('目的地费用')
  if (!c.duty) names.push('进口关税、进口增值税')
  return names.join('、')
})

function onTransportChange(e) {
  const picked = MODE_OPTIONS[Number(e.detail.value)]
  if (!picked) return
  const prev = form.transportMode
  form.transportMode = picked.code
  // 术语按语义层级自动映射，非法则回退目标方式的默认术语
  const nextTerm = remapTerm(form.tradeTerm, prev, picked.code)
  // 术语变了 → 手动价口径不再适用，清空回到按成本计算
  if (nextTerm !== form.tradeTerm) form.manualUnitPrice = ''
  form.tradeTerm = nextTerm
}

function onTermChange(e) {
  const picked = termsForMode(form.transportMode)[Number(e.detail.value)]
  if (!picked || picked.code === form.tradeTerm) return
  form.tradeTerm = picked.code
  // 切换术语 → 清空手动价，避免口径错乱
  form.manualUnitPrice = ''
}

function isMultiActive(code) {
  return form.multimodal.indexOf(code) !== -1
}

function toggleMulti(code) {
  const i = form.multimodal.indexOf(code)
  if (i === -1) form.multimodal.push(code)
  else form.multimodal.splice(i, 1)
}

// ---- 表单记忆：只记稳定字段，产品名/客户名/汇率不记 ----
const MEMO_KEYS = [
  'price',
  'qty',
  'vatRate',
  'rebateRate',
  'feeCustoms',
  'feeTrucking',
  'feePort',
  'feeDocs',
  'feeBank',
  'feeWarehouse',
  'feeOther',
  'currency',
  'profitRate',
  'transportMode',
  'tradeTerm',
  'multimodal',
  'freight',
  'insuranceRate',
  'markupRate',
  'destinationFee',
  'tariffRate',
  'importVatRate',
  'manualUnitPrice',
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
  form.manualUnitPrice = '' // 切换币种 → 清空手动价，避免口径错乱
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

// ---- 拍照填单：选图 → 识别 → 只填识别到的字段 ----
const ocr = reactive({
  loading: false,
  thumb: '', // 选中图片的 data URL（缩略图）
  error: '', // 后端返回的错误信息
  filled: [], // 实际填入的字段名
  missing: [], // 未识别到的关键字段名
  notes: '', // 单据备注
  cartonSynced: false, // 箱规/毛重是否已写入装柜页记忆
})

const hasValue = (v) => v !== null && v !== undefined && v !== ''

/** 把识别结果按字段映射写入表单；null 跳过，不动用户其他已填内容 */
function applyOcrFields(fields) {
  const filled = []
  const missing = []
  let cartonSynced = false

  // 产品名 / 客户名
  if (hasValue(fields.productName)) {
    form.productName = String(fields.productName)
    filled.push('产品名')
  } else missing.push('产品名')
  if (hasValue(fields.customerName)) {
    form.customerName = String(fields.customerName)
    filled.push('客户名')
  } else missing.push('客户名')

  // 数量 / 单价（采购成本含税）
  if (hasValue(fields.qty)) {
    form.qty = fields.qty
    filled.push('数量')
  } else missing.push('数量')
  if (hasValue(fields.price)) {
    form.price = fields.price
    filled.push('单价')
  } else missing.push('单价')

  // 税率
  if (hasValue(fields.vatRate)) {
    form.vatRate = fields.vatRate
    filled.push('增值税率')
  } else missing.push('增值税率')
  if (hasValue(fields.rebateRate)) {
    form.rebateRate = fields.rebateRate
    filled.push('退税率')
  } else missing.push('退税率')

  // 币种：仅当在 CURRENCIES 表内才采纳，并重拉该币种实时汇率
  if (hasValue(fields.currency)) {
    const code = String(fields.currency).toUpperCase()
    if (CURRENCIES.some((c) => c.code === code)) {
      form.currency = code
      form.manualUnitPrice = '' // 换币种 → 清空手动价，避免口径错乱
      fx.manual = false
      fx.data = null
      fetchFx({ force: true })
      filled.push('币种')
    } else {
      missing.push('币种')
    }
  } else missing.push('币种')

  // 箱规 + 毛重 → 合并写入装柜页记忆（字段名为 length/width/height/grossWeight）
  const hasCarton = hasValue(fields.cartonL) || hasValue(fields.cartonW) || hasValue(fields.cartonH)
  const saved = loadForm('loading') || {}
  if (hasValue(fields.cartonL)) saved.length = fields.cartonL
  if (hasValue(fields.cartonW)) saved.width = fields.cartonW
  if (hasValue(fields.cartonH)) saved.height = fields.cartonH
  if (hasValue(fields.grossWeight)) saved.grossWeight = fields.grossWeight
  if (hasCarton || hasValue(fields.grossWeight)) {
    saveForm('loading', saved)
    cartonSynced = true
  }
  if (hasCarton) filled.push('箱规')
  else missing.push('箱规')
  if (hasValue(fields.grossWeight)) filled.push('毛重')
  else missing.push('毛重')

  ocr.filled = filled
  ocr.missing = missing
  ocr.notes = hasValue(fields.notes) ? String(fields.notes) : ''
  ocr.cartonSynced = cartonSynced
}

async function onOcr() {
  if (ocr.loading) return
  ocr.error = ''
  ocr.filled = []
  ocr.missing = []
  ocr.notes = ''
  ocr.cartonSynced = false

  let dataUrl
  try {
    dataUrl = await pickImageAsDataUrl()
  } catch (e) {
    ocr.error = (e && e.message) || '选择图片失败'
    return
  }
  if (!dataUrl) return // 用户取消

  ocr.thumb = dataUrl
  ocr.loading = true
  try {
    const res = await parseImage(dataUrl)
    applyOcrFields(res.fields || {})
  } catch (e) {
    ocr.error = (e && e.message) || '识别失败'
  } finally {
    ocr.loading = false
  }
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
    // 兼容旧记忆：旧结构把国内费用打包成 domesticFee（报关/拖车/单证/银行，本就不含仓储费），
    // 仓储费另存 warehouseFee。新的 7 项明细都不存在时按此迁移，保证默认合计与旧总成本一致。
    const hasNewFees = FEE_KEYS.some((k) => saved[k] !== undefined && saved[k] !== null)
    if (!hasNewFees && (saved.domesticFee !== undefined || saved.warehouseFee !== undefined)) {
      // 明细从 0 起算，避免叠加表单里 7 项的默认值（否则合计会翻倍）
      FEE_KEYS.forEach((k) => { form[k] = 0 })
      if (saved.domesticFee !== undefined && saved.domesticFee !== null) {
        form.feeOther = safeNumber(saved.domesticFee)
      }
      // 仓储费单独落到 feeWarehouse，不并入 feeOther，避免与旧总额重复计算
      if (saved.warehouseFee !== undefined && saved.warehouseFee !== null) {
        form.feeWarehouse = safeNumber(saved.warehouseFee)
      }
    }
    // 记忆里的币种可能已失效，回退 USD
    form.currency = getCurrency(form.currency).code
    // 记忆里的运输方式/组合可能是旧值，校验后回退
    if (!MODE_OPTIONS.some((m) => m.code === form.transportMode)) {
      form.transportMode = TRANSPORT_MODES[0].code
    }
    form.multimodal = Array.isArray(form.multimodal)
      ? form.multimodal.filter((c) => TRANSPORT_MODES.some((m) => m.code === c))
      : []
  }
  // 术语必须与当前运输方式匹配（旧记忆或跨方式残留），否则回退该方式默认
  if (!isValidTerm(form.tradeTerm, form.transportMode)) {
    form.tradeTerm = defaultTerm(form.transportMode)
  }
  // 记忆里的手动价若无法解析为有限数，视为无效，回退按成本计算
  if (form.manualUnitPrice !== '' && !Number.isFinite(Number(form.manualUnitPrice))) {
    form.manualUnitPrice = ''
  }
  fetchFx()
})

function onSave() {
  // 多式联运必须至少选 2 种，否则存进去的是无效组合
  if (isMultimodal.value && form.multimodal.length < 2) {
    uni.showToast({ title: '多式联运至少选 2 种', icon: 'none' })
    return
  }

  const r = result.value
  const v = view.value
  const record = {
    id: makeId(),
    productName: form.productName || '未命名产品',
    customerName: form.customerName || '',
    currency: form.currency,
    transportMode: form.transportMode,
    multimodal: isMultimodal.value ? [...form.multimodal] : [],
    tradeTerm: r.tradeTerm,
    unitPrice: v.unitPrice,
    totalPrice: v.totalPrice,
    createdAt: Date.now(),
    input: { ...form },
    // 手动定价时，展示口径的金额/费用/换汇成本/盈亏率一并按手动口径存档
    result: {
      ...r,
      unitPrice: v.unitPrice,
      totalPrice: v.totalPrice,
      insurance: v.insurance,
      tariff: v.tariff,
      importVat: v.importVat,
      exchangeCost: v.exchangeCost,
      profitPct: v.profitPct,
    },
  }
  saveRecord(record)
  uni.showToast({ title: '已保存', icon: 'success' })
}

function onCopyQuote() {
  // 同理：多式联运没选够 2 种时不给复制，避免发出去的是无效报价单
  if (isMultimodal.value && form.multimodal.length < 2) {
    uni.showToast({ title: '多式联运至少选 2 种', icon: 'none' })
    return
  }

  const r = result.value
  const v = view.value
  const code = form.currency
  const productName = form.productName || '未命名产品'
  const customerName = form.customerName || '未填写客户'
  const transportText = isMultimodal.value
    ? `${MULTIMODAL.name}（${multiText.value || '未选择组合'}）`
    : transportLabel.value
  // 外贸单据统一用币种代码，避免 ¥ / $ 符号歧义；只报所选术语
  const lines = [
    `【报价单】${productName} - ${customerName}`,
    `币种：${code}`,
    `运输方式：${transportText}`,
    `贸易方式：${termLabelText.value}`,
    `${r.tradeTerm}：${code} ${fmt(v.unitPrice)}/件（总价 ${code} ${fmt(v.totalPrice)}）`,
  ]
  // 手动定价时补一行说明，标明手填单价及其成本加成率
  if (manualActive.value) {
    lines.push(`定价方式：手动定价（成本加成率 ${fmt(v.markupPct, 2)}%）`)
  }
  lines.push(
    `数量：${fmt(r.qty, 0)} 件 | 汇率：1 ${code} = ${rateText.value} ¥ | 盈亏率：${fmt(v.profitPct, 2)}%`,
    '有效期：30 天',
  )
  const text = lines.join('\n')
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'success' }),
  })
}
</script>

<style scoped>
/* ---- 拍照填单 ---- */
.ocr-btn {
  margin-top: 12rpx;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
  background: #2563eb;
  border-radius: 12rpx;
  padding: 24rpx 0;
}
.ocr-btn-disabled {
  background: #93b4f3;
}
.ocr-hint {
  font-size: 22rpx;
  line-height: 1.5;
  color: #9ca3af;
  padding-top: 12rpx;
}
.ocr-thumb-wrap {
  position: relative;
  margin-top: 16rpx;
  width: 220rpx;
  height: 220rpx;
  border-radius: 12rpx;
  overflow: hidden;
  border: 1rpx solid #e5e7eb;
}
.ocr-thumb {
  width: 100%;
  height: 100%;
}
.ocr-thumb-tip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  font-size: 22rpx;
  line-height: 1.6;
  text-align: center;
  color: #ffffff;
  background: rgba(17, 24, 39, 0.6);
}
.ocr-error {
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #dc2626;
}
.ocr-result {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx dashed #e5e7eb;
}
.ocr-ok {
  font-size: 24rpx;
  line-height: 1.6;
  color: #16a34a;
}
.ocr-miss {
  font-size: 24rpx;
  line-height: 1.6;
  color: #d97706;
}
.ocr-note {
  font-size: 24rpx;
  line-height: 1.6;
  color: #4b5563;
}
.ocr-sync {
  font-size: 22rpx;
  line-height: 1.6;
  color: #2563eb;
}

/* 币种选择：picker 包裹的 field 需要补回底部分隔线 */
picker .field {
  border-bottom: 1rpx solid #f0f1f3;
}
.field-picker {
  color: #111827;
  font-size: 28rpx;
}

/* 国内费用只读合计：输入框样式但灰底不可编辑，与上方可填写的明细项区分 */
.field-input-readonly {
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 8rpx;
  padding: 0 12rpx;
  height: 52rpx;
  line-height: 52rpx;
  box-sizing: border-box;
}
/* 明细填写提示小字 */
.fee-hint {
  font-size: 22rpx;
  line-height: 1.5;
  color: #9ca3af;
  padding-top: 8rpx;
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

/* 多式联运：勾选组合的小字提示与已选概览 */
.multi-hint {
  font-size: 22rpx;
  color: #6b7280;
  padding-top: 8rpx;
}
.multi-summary {
  font-size: 24rpx;
  color: #111827;
  padding: 4rpx 0 8rpx;
}
.multi-warn {
  font-size: 22rpx;
  line-height: 1.5;
  color: #d97706;
  padding-bottom: 8rpx;
}

/* 贸易术语小字说明（FAS/FOB/FCA 共用基准、DPU 卸货费） */
.term-note {
  font-size: 22rpx;
  line-height: 1.5;
  color: #9ca3af;
  padding-top: 8rpx;
}
/* 输入标签后的灰色「本术语不计入」 */
.label-note {
  font-size: 22rpx;
  color: #9ca3af;
}

/* 结果区：术语单价/总价大一号加粗 */
.result-main {
  font-size: 34rpx;
  color: #111827;
}
/* 手动价低于成本时的红色金额（scoped 覆盖 .result-main 的黑色） */
.low {
  color: #dc2626;
}

/* 单价可编辑：输入框 + 手动标记 + 恢复按钮 */
.result-line-edit {
  align-items: flex-start;
}
.unit-edit {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
  max-width: 480rpx;
}
.unit-input {
  width: 180rpx;
  text-align: right;
  font-size: 34rpx;
  font-weight: 600;
  color: #111827;
  border-bottom: 1rpx dashed #cbd5e1;
  padding: 0 4rpx;
}
.unit-input-on {
  border-bottom-color: #2563eb;
}
.unit-low {
  color: #dc2626;
  border-bottom-color: #dc2626;
}
.unit-unit {
  font-size: 26rpx;
  color: #6b7280;
}
.manual-tag {
  font-size: 20rpx;
  line-height: 1;
  color: #2563eb;
  background: #eff6ff;
  border: 1rpx solid #bfdbfe;
  border-radius: 6rpx;
  padding: 4rpx 10rpx;
}
.manual-restore {
  font-size: 22rpx;
  color: #2563eb;
}
/* 结果区细分隔线 */
.dash {
  border-top: 1rpx dashed #e5e7eb;
  margin: 8rpx 0;
}
/* 结果区灰色「未计入」提示 */
.result-note {
  font-size: 22rpx;
  line-height: 1.5;
  color: #9ca3af;
  padding-top: 12rpx;
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
