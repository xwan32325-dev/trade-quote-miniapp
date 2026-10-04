<!-- 报价计算页：录入运输方式、贸易术语、成本与费用，实时算出所选术语的单价/总价与换汇成本、盈亏率 -->
<template>
  <view class="page">
    <view class="card">
      <view class="card-title">拍照填单</view>
      <view class="ocr-btn" :class="{ 'ocr-btn-disabled': ocr.loading }" @click="onOcr">
        {{ ocr.loading ? '识别中…' : '📷 拍照填单' }}
      </view>
      <view class="ocr-hint">拍采购单 / 发票 / 装箱单，自动识别产品、数量、单价、箱规（支持多产品）</view>
      <view class="ocr-thumb-wrap" v-if="ocr.thumb">
        <image class="ocr-thumb" :src="ocr.thumb" mode="aspectFill" />
        <text v-if="ocr.loading" class="ocr-thumb-tip">识别中…</text>
      </view>
      <view class="ocr-error" v-if="ocr.error">{{ ocr.error }}</view>
      <view class="ocr-result" v-if="ocr.filled.length || ocr.missing.length || ocr.notes">
        <view class="ocr-ok" v-if="ocr.multiCount > 1">✅ 已识别到 {{ ocr.multiCount }} 个产品，已替换当前明细</view>
        <view class="ocr-ok" v-if="ocr.filled.length">✅ 已填入：{{ ocr.filled.join('、') }}</view>
        <view class="ocr-miss" v-if="ocr.missing.length">未识别到：{{ ocr.missing.join('、') }}</view>
        <view class="ocr-note" v-if="ocr.notes">单据备注：{{ ocr.notes }}</view>
        <view class="ocr-sync" v-if="ocr.cartonSynced">箱规已同步到装柜页</view>
      </view>
    </view>

    <view class="card">
      <view class="card-title">产品明细</view>
      <view class="field">
        <text class="field-label">客户名</text>
        <input class="field-input" v-model="form.customerName" placeholder="可留空" />
      </view>
      <view class="item-card" v-for="(it, idx) in form.items" :key="idx">
        <view class="item-head">
          <text class="item-no">产品 {{ idx + 1 }}</text>
          <text
            class="item-del"
            :class="{ 'item-del-off': form.items.length <= 1 }"
            @click="removeItem(idx)"
          >删除</text>
        </view>
        <view class="field">
          <text class="field-label">产品名称</text>
          <input class="field-input" v-model="it.productName" placeholder="可留空" />
        </view>
        <view class="field">
          <text class="field-label">数量</text>
          <input class="field-input" type="digit" v-model="it.qty" />
          <text class="field-unit">件</text>
        </view>
        <view class="field">
          <text class="field-label">采购成本（含税）</text>
          <input class="field-input" type="digit" v-model="it.price" />
          <text class="field-unit">¥/件</text>
        </view>
        <view class="field">
          <text class="field-label">增值税率</text>
          <input class="field-input" type="digit" v-model="it.vatRate" />
          <text class="field-unit">%</text>
        </view>
        <view class="chips">
          <text
            v-for="v in VAT_RATES"
            :key="v"
            class="chip"
            :class="{ 'chip-active': Number(it.vatRate) === v }"
            @click="it.vatRate = v"
          >{{ v }}%</text>
        </view>
        <view class="field">
          <text class="field-label">出口退税率</text>
          <input class="field-input" type="digit" v-model="it.rebateRate" />
          <text class="field-unit">%</text>
        </view>
        <view class="chips">
          <text
            v-for="v in REBATE_RATES"
            :key="v"
            class="chip"
            :class="{ 'chip-active': Number(it.rebateRate) === v }"
            @click="it.rebateRate = v"
          >{{ v }}%</text>
        </view>
      </view>
      <view class="add-item" @click="addItem">+ 添加产品</view>
    </view>

    <view class="card">
      <view class="card-title">国内费用</view>
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
        <text class="field-label">{{ result.tradeTerm }} {{ isMulti ? '整单总价' : '单价' }}</text>
        <view class="unit-edit">
          <input
            class="unit-input"
            :class="{ 'unit-input-on': manualActive, 'unit-low': view.belowCost }"
            type="digit"
            :value="priceInputText"
            @input="onPriceInput"
          />
          <text class="unit-unit">{{ isMulti ? symbol : symbol + ' / 件' }}</text>
          <text v-if="manualActive" class="manual-tag">手动</text>
          <text v-if="manualActive" class="manual-restore" @click="restoreAutoPrice">恢复按成本计算</text>
        </view>
      </view>
      <view class="result-line">
        <text class="field-label">整单总价</text>
        <text class="result-value result-main" :class="{ low: view.belowCost }">{{ symbol }} {{ fmt(view.totalPrice) }}</text>
      </view>
      <!-- 每行按货值占比分摊整单总价；最后一行兜底，保证明细合计 = 整单合计 -->
      <view class="item-table">
        <view class="item-row item-row-head">
          <text class="it-no">#</text>
          <text class="it-name">产品名称规格</text>
          <text class="it-qty">数量</text>
          <text class="it-price">单价</text>
          <text class="it-amount">金额</text>
        </view>
        <view class="item-row" v-for="(row, i) in allocatedItems" :key="i">
          <text class="it-no">{{ i + 1 }}</text>
          <text class="it-name">{{ row.productName || '未命名产品' }}</text>
          <text class="it-qty">{{ fmt(row.qty, 0) }}</text>
          <text class="it-price">{{ fmt(row.unitPrice) }}</text>
          <text class="it-amount">{{ fmt(row.totalPrice) }}</text>
        </view>
        <view class="item-row item-row-total" v-if="allocatedItems.length > 1">
          <text class="it-no"></text>
          <text class="it-name">合计</text>
          <text class="it-qty">{{ fmt(totalQty, 0) }}</text>
          <text class="it-price">—</text>
          <text class="it-amount">{{ fmt(view.totalPrice) }}</text>
        </view>
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
      <view class="btn btn-export" @click="openExport">📄 导出报价单</view>
    </view>

    <!-- 导出面板：填写公司信息与备注，生成可直接发客户的图片 / PDF 报价单 -->
    <view class="export-mask" v-if="exportState.show" @click="closeExport">
      <view class="export-panel" @click.stop>
        <view class="export-head">
          <text class="export-title">导出报价单</text>
          <text class="export-close" @click="closeExport">✕</text>
        </view>
        <scroll-view class="export-body" scroll-y>
          <view class="export-section">公司信息</view>
          <view class="export-hint-line">填写一次后自动记住，下次导出无需再填</view>
          <view class="field">
            <text class="field-label">公司名称</text>
            <input class="field-input" v-model="exportState.company.name" placeholder="如：上海某某进出口有限公司" />
          </view>
          <view class="field">
            <text class="field-label">地址</text>
            <input class="field-input" v-model="exportState.company.address" placeholder="如：上海市浦东新区某某路 100 号" />
          </view>
          <view class="field">
            <text class="field-label">联系人</text>
            <input class="field-input" v-model="exportState.company.contact" placeholder="如：张经理" />
          </view>
          <view class="field">
            <text class="field-label">电话</text>
            <input class="field-input" type="text" v-model="exportState.company.phone" placeholder="如：13800000000" />
          </view>
          <view class="field">
            <text class="field-label">邮箱</text>
            <input class="field-input" type="text" v-model="exportState.company.email" placeholder="如：sales@example.com" />
          </view>
          <view class="export-section">备注</view>
          <view class="field">
            <text class="field-label">备注</text>
            <input class="field-input" v-model="exportState.remark" placeholder="选填，如：报价有效期 30 天" />
          </view>
          <view
            class="export-btn"
            :class="{ 'export-btn-disabled': exportState.loading }"
            @click="onExport('png')"
          >{{ exportState.loading && exportState.format === 'png' ? '生成中…' : '📷 生成图片报价单' }}</view>
          <view class="export-btn-note">可直接在微信里发给客户</view>
          <view
            class="export-btn export-btn-ghost"
            :class="{ 'export-btn-disabled': exportState.loading }"
            @click="onExport('pdf')"
          >{{ exportState.loading && exportState.format === 'pdf' ? '生成中…' : '📄 导出 PDF 报价单' }}</view>
          <view class="export-btn-note">适合正式邮件 / 打印</view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, computed, onMounted, watch } from 'vue'
import { formatNumber, safeNumber } from '../../utils/calc.js'
import { saveRecord, makeId, saveForm, loadForm } from '../../utils/storage.js'
import { getFxRate, parseImage, buildQuoteDocUrl } from '../../utils/request.js'
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
  allocateItems,
  sumItems,
  termsForMode,
  defaultTerm,
  remapTerm,
  isValidTerm,
  termLabel,
} from '../../utils/incoterms.js'

// 一行产品明细的默认值（首行与「+ 添加产品」共用；新增行产品名/单价留空）
function makeItem(full = false) {
  return {
    productName: '',
    qty: full ? 1000 : 1,
    price: full ? 100 : 0,
    vatRate: 13,
    rebateRate: 13,
  }
}

// 表单默认值（与 SPEC 一致）；贸易术语默认取当前运输方式的默认值（海运 FOB）
const form = reactive({
  customerName: '',
  // 产品明细：一次报价可含多款（主产品 + 配件 + 包装），每行独立数量/含税采购价/税率
  items: [makeItem(true)],
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
  // 手动定价输入：单行时为单价，多行时为整单总价（空串 = 按成本计算）
  manualPrice: '',
})

// ---- 明细行增删：至少保留 1 行 ----
function addItem() {
  form.items.push(makeItem())
}
function removeItem(idx) {
  if (form.items.length <= 1) {
    uni.showToast({ title: '至少保留一个产品', icon: 'none' })
    return
  }
  form.items.splice(idx, 1)
}
const isMulti = computed(() => form.items.length > 1)
// 整单总数量 = Σ 各行数量（用于展示与导出）
const totalQty = computed(() => form.items.reduce((sum, it) => sum + safeNumber(it.qty), 0))

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
// 计算输入：把明细与 domesticFee（7 项合计）送入计算，公式与外部接口保持不变
const calcInput = computed(() => ({ ...form, items: form.items, domesticFee: domesticFeeTotal.value }))
const result = computed(() => calcTermQuote(calcInput.value))

// ---- 手动定价状态机：manualPrice 非空即进入手动定价 ----
const manualActive = computed(
  () => form.manualPrice !== '' && form.manualPrice !== null && form.manualPrice !== undefined,
)

// 分摊基数：手动定价取手填值（多行为整单总价、单行为单价×数量），否则取按成本算出的术语总价
const allocBasePrice = computed(() => {
  if (!manualActive.value) return result.value.totalPrice
  const p = safeNumber(form.manualPrice)
  return isMulti.value ? p : p * totalQty.value
})

// 每行分摊（新口径见 TASK-ROUNDING.md 第一节）：行金额 = round(行单价 × 行数量)，
// 保证「单价 × 数量 = 金额」；手动定价多行时精确命中手填整单总价（最后一行兜底，单价允许 3 位）
const allocatedItems = computed(() =>
  allocateItems(form.items, allocBasePrice.value, manualActive.value && isMulti.value),
)
// 整单总价 = Σ 行金额（结果区、合计行、复制、保存、导出统一用这一个数）
const grandTotal = computed(() => sumItems(allocatedItems.value))
// 第一行单价（单行报价的单价展示、记录里的 unitPrice）
const firstUnitPrice = computed(() =>
  allocatedItems.value.length ? allocatedItems.value[0].unitPrice : 0,
)
// 换汇成本 / 盈亏率 / 成本加成率：基于 Σ 行金额 反算（与按成本口径的差异只在分位）
const totalMetrics = computed(() => calcManualTermQuote(calcInput.value, grandTotal.value, true))

// 定价输入框显示值：手动时显示输入原值，否则显示分摊后的值（单行为单价、多行为整单总价）
const priceInputText = computed(() => {
  if (manualActive.value) return String(form.manualPrice)
  const auto = isMulti.value ? grandTotal.value : firstUnitPrice.value
  return safeNumber(auto).toFixed(2)
})
function onPriceInput(e) {
  form.manualPrice = e.detail.value
}
// 点「恢复按成本计算」→ 清空手动价回到计算值
function restoreAutoPrice() {
  form.manualPrice = ''
}

// 结果区展示口径：金额统一取分摊后的同一组数；手动定价时费用/指标改用基于 Σ 行金额 的反算值
const view = computed(() => {
  const r = result.value
  const t = totalMetrics.value
  if (!manualActive.value) {
    return {
      manual: false,
      unitPrice: firstUnitPrice.value,
      totalPrice: grandTotal.value,
      freight: r.freight,
      insurance: r.insurance,
      destinationFee: r.destinationFee,
      tariff: r.tariff,
      importVat: r.importVat,
      exchangeCost: t.exchangeCost,
      profitPct: t.profitPct,
      isProfit: t.isProfit,
      isLoss: t.isLoss,
      markupPct: null,
      belowCost: false,
      shortfall: 0,
    }
  }
  return {
    manual: true,
    unitPrice: firstUnitPrice.value,
    totalPrice: grandTotal.value,
    freight: t.freight,
    insurance: t.insurance, // 保险费按整单总价（Σ 行金额）计
    destinationFee: t.destinationFee,
    tariff: t.tariff,
    importVat: t.importVat,
    exchangeCost: t.exchangeCost,
    profitPct: t.profitPct,
    isProfit: t.isProfit,
    isLoss: t.isLoss,
    markupPct: t.markupPct,
    belowCost: t.belowCost,
    shortfall: t.shortfall,
  }
})

// 首行产品名（记录标题 / 导出扁平字段的兜底）
const firstItemName = computed(() => (form.items[0] && form.items[0].productName) || '未命名产品')

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
  if (nextTerm !== form.tradeTerm) form.manualPrice = ''
  form.tradeTerm = nextTerm
}

function onTermChange(e) {
  const picked = termsForMode(form.transportMode)[Number(e.detail.value)]
  if (!picked || picked.code === form.tradeTerm) return
  form.tradeTerm = picked.code
  // 切换术语 → 清空手动价，避免口径错乱
  form.manualPrice = ''
}

function isMultiActive(code) {
  return form.multimodal.indexOf(code) !== -1
}

function toggleMulti(code) {
  const i = form.multimodal.indexOf(code)
  if (i === -1) form.multimodal.push(code)
  else form.multimodal.splice(i, 1)
}

// ---- 表单记忆：记忆客户名、国内费用明细、费率、手动价等稳定字段（明细行 items 单独处理）----
const MEMO_KEYS = [
  'customerName',
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
  'manualPrice',
]

watch(
  form,
  () => {
    const payload = {}
    MEMO_KEYS.forEach((k) => {
      payload[k] = form[k]
    })
    // 明细行整组记忆（含产品名与各行税率）
    payload.items = form.items.map((it) => ({ ...it }))
    saveForm('quote', payload)
  },
  { deep: true },
)

// 明细行归一化：字段缺失/非法时回退默认值，保证任何来源（旧记忆/识别结果）都可安全使用
function normalizeItem(src) {
  const it = src || {}
  const pick = (k, fallback) => (it[k] !== undefined && it[k] !== null ? it[k] : fallback)
  return {
    productName: it.productName !== undefined && it.productName !== null ? String(it.productName) : '',
    qty: pick('qty', 1000),
    price: pick('price', 100),
    vatRate: pick('vatRate', 13),
    rebateRate: pick('rebateRate', 13),
  }
}

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
  form.manualPrice = '' // 切换币种 → 清空手动价，避免口径错乱
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
  multiCount: 0, // 识别到的产品行数（>1 时说明替换了当前明细）
})

const hasValue = (v) => v !== null && v !== undefined && v !== ''

/** 识别结果单行 → 明细行（缺失税率回退 13%，与页面默认一致） */
function ocrItem(it) {
  const src = it || {}
  return {
    productName: hasValue(src.productName) ? String(src.productName) : '',
    qty: hasValue(src.qty) ? src.qty : '',
    price: hasValue(src.price) ? src.price : hasValue(src.unitPrice) ? src.unitPrice : '',
    vatRate: hasValue(src.vatRate) ? src.vatRate : 13,
    rebateRate: hasValue(src.rebateRate) ? src.rebateRate : 13,
  }
}

/** 把识别结果按字段映射写入表单；null 跳过，不动用户其他已填内容 */
function applyOcrFields(fields) {
  const filled = []
  const missing = []
  let cartonSynced = false

  // 多产品明细：识别到多行时整组替换当前明细（先清空再加行）
  const ocrItems = Array.isArray(fields.items) ? fields.items : []
  ocr.multiCount = ocrItems.length
  if (ocrItems.length > 1) {
    form.items = ocrItems.map(ocrItem)
    form.manualPrice = '' // 明细变了 → 手动价口径不再适用
    filled.push(`产品明细（${ocrItems.length} 项）`)
  } else {
    // 单行 / 无 items：行为同现在——只把识别到的字段填进当前第一行，其余不动
    const single = ocrItems.length === 1 ? ocrItems[0] : {}
    const pick = (k) => (hasValue(fields[k]) ? fields[k] : single[k])
    const first = form.items[0] || (form.items[0] = makeItem(true))
    if (hasValue(pick('productName'))) {
      first.productName = String(pick('productName'))
      filled.push('产品名')
    } else missing.push('产品名')
    if (hasValue(pick('qty'))) {
      first.qty = pick('qty')
      filled.push('数量')
    } else missing.push('数量')
    if (hasValue(pick('price'))) {
      first.price = pick('price')
      filled.push('单价')
    } else missing.push('单价')
    if (hasValue(pick('vatRate'))) {
      first.vatRate = pick('vatRate')
      filled.push('增值税率')
    } else missing.push('增值税率')
    if (hasValue(pick('rebateRate'))) {
      first.rebateRate = pick('rebateRate')
      filled.push('退税率')
    } else missing.push('退税率')
  }

  // 客户名
  if (hasValue(fields.customerName)) {
    form.customerName = String(fields.customerName)
    filled.push('客户名')
  } else missing.push('客户名')

  // 币种：仅当在 CURRENCIES 表内才采纳，并重拉该币种实时汇率
  if (hasValue(fields.currency)) {
    const code = String(fields.currency).toUpperCase()
    if (CURRENCIES.some((c) => c.code === code)) {
      form.currency = code
      form.manualPrice = '' // 换币种 → 清空手动价，避免口径错乱
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
  ocr.multiCount = 0

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

onMounted(() => {
  const saved = loadForm('quote')
  if (saved) {
    MEMO_KEYS.forEach((k) => {
      if (saved[k] !== undefined && saved[k] !== null) form[k] = saved[k]
    })
    // 明细记忆：新结构为 items[]；旧记忆只有扁平的 productName/qty/price/vatRate/rebateRate → 迁移成 1 行
    if (Array.isArray(saved.items) && saved.items.length) {
      form.items = saved.items.map(normalizeItem)
    } else if (
      saved.productName !== undefined || saved.qty !== undefined || saved.price !== undefined ||
      saved.vatRate !== undefined || saved.rebateRate !== undefined
    ) {
      form.items = [normalizeItem(saved)]
    }
    // 旧记忆的手动价字段名是 manualUnitPrice（语义同为「输入框数值」）
    if (saved.manualPrice === undefined && saved.manualUnitPrice !== undefined) {
      form.manualPrice = saved.manualUnitPrice
    }
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
  if (form.manualPrice !== '' && !Number.isFinite(Number(form.manualPrice))) {
    form.manualPrice = ''
  }
  // 明细至少保留 1 行，避免空数组导致整单货值为 0 后界面无行可编辑
  if (!Array.isArray(form.items) || !form.items.length) form.items = [makeItem(true)]
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
    productName: firstItemName.value,
    // 单行/多行明细（含分摊后的行单价与行金额），历史页据此展示「第一款名 等 N 项」
    items: allocatedItems.value,
    customerName: form.customerName || '',
    currency: form.currency,
    transportMode: form.transportMode,
    multimodal: isMultimodal.value ? [...form.multimodal] : [],
    tradeTerm: r.tradeTerm,
    unitPrice: v.unitPrice,
    totalPrice: v.totalPrice,
    createdAt: Date.now(),
    input: { ...form, items: form.items.map((it) => ({ ...it })) },
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
  const productName = firstItemName.value
  const customerName = form.customerName || '未填写客户'
  const transportText = isMultimodal.value
    ? `${MULTIMODAL.name}（${multiText.value || '未选择组合'}）`
    : transportLabel.value
  // 外贸单据统一用币种代码，避免 ¥ / $ 符号歧义；只报所选术语
  const title = isMulti.value ? `${productName} 等 ${form.items.length} 项` : productName
  const lines = [
    `【报价单】${title} - ${customerName}`,
    `币种：${code}`,
    `运输方式：${transportText}`,
    `贸易方式：${termLabelText.value}`,
  ]
  if (isMulti.value) {
    // 多产品：逐行列明细，最后给整单总价
    lines.push('明细：')
    allocatedItems.value.forEach((row, i) => {
      lines.push(`  ${i + 1}. ${row.productName || '未命名产品'} ${fmt(row.qty, 0)} 件 × ${code} ${fmt(row.unitPrice)} = ${code} ${fmt(row.totalPrice)}`)
    })
    lines.push(`${r.tradeTerm} 整单总价：${code} ${fmt(v.totalPrice)}`)
  } else {
    lines.push(`${r.tradeTerm}：${code} ${fmt(v.unitPrice)}/件（总价 ${code} ${fmt(v.totalPrice)}）`)
  }
  // 手动定价时补一行说明
  if (manualActive.value) {
    lines.push(
      isMulti.value
        ? `定价方式：手动定价（整单总价，成本加成率 ${fmt(v.markupPct, 2)}%）`
        : `定价方式：手动定价（成本加成率 ${fmt(v.markupPct, 2)}%）`,
    )
  }
  lines.push(
    `数量：${fmt(totalQty.value, 0)} 件 | 汇率：1 ${code} = ${rateText.value} ¥ | 盈亏率：${fmt(v.profitPct, 2)}%`,
    '有效期：30 天',
  )
  const text = lines.join('\n')
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'success' }),
  })
}

// ---- 导出报价单：公司信息 + 备注本地记忆（key = form:company），生成图片 / PDF ----
const COMPANY_KEYS = ['name', 'address', 'contact', 'phone', 'email']
const exportState = reactive({
  show: false,
  loading: false, // 正在生成，防重复点击
  format: '', // 正在生成的格式 'png' | 'pdf'
  company: { name: '', address: '', contact: '', phone: '', email: '' },
  remark: '',
})

// 公司信息与备注一起记忆，避免多次打开重填
function saveCompanyMemo() {
  saveForm('company', { ...exportState.company, remark: exportState.remark })
}
watch(() => exportState.company, saveCompanyMemo, { deep: true })
watch(() => exportState.remark, saveCompanyMemo)

function openExport() {
  const saved = loadForm('company')
  if (saved) {
    COMPANY_KEYS.forEach((k) => {
      if (saved[k] !== undefined && saved[k] !== null) exportState.company[k] = saved[k]
    })
    if (saved.remark !== undefined && saved.remark !== null) exportState.remark = saved.remark
  }
  exportState.show = true
}

function closeExport() {
  if (exportState.loading) return // 生成中不允许关闭，避免状态错乱
  exportState.show = false
}

// 组装后端 payload：行单价/行金额/整单总价与结果区同源（金额 = 单价 × 数量）
function buildExportPayload(format) {
  const r = result.value
  const rows = allocatedItems.value.map((row) => ({
    productName: row.productName || '未命名产品',
    qty: row.qty,
    unitPrice: row.unitPrice,
    totalPrice: row.totalPrice,
  }))
  // 导出前自检：Σ 行金额必须等于整单总价（容差 0.01），不一致时暴露出来便于以后回归
  const sum = sumItems(rows)
  if (Math.abs(sum - grandTotal.value) > 0.01) {
    console.warn(`[quote-doc] 金额自检失败：Σ行金额 ${sum} ≠ 整单总价 ${grandTotal.value}`)
    uni.showToast({ title: '金额自检异常，请核对明细', icon: 'none' })
  }
  // 扁平字段取第一行（向后兼容旧后端），同样满足 单价 × 数量 = 金额
  const first = rows[0] || { productName: firstItemName.value, qty: 0, unitPrice: 0, totalPrice: 0 }
  return {
    quote: {
      items: rows,
      productName: first.productName,
      customerName: form.customerName || '',
      qty: first.qty,
      unitPrice: first.unitPrice,
      totalPrice: first.totalPrice,
      currency: form.currency,
      tradeTerm: r.tradeTerm,
      transportMode: isMultimodal.value ? MULTIMODAL.name : transportLabel.value,
      multimodalText: isMultimodal.value ? multiText.value : '',
      exchangeRate: safeNumber(form.exchangeRate),
      remark: exportState.remark,
    },
    company: { ...exportState.company },
    format,
  }
}

// 低于成本时二次确认（手动定价场景），返回是否继续
function confirmBelowCost() {
  if (!view.value.belowCost) return Promise.resolve(true)
  return new Promise((resolve) => {
    uni.showModal({
      title: '提示',
      content: '当前报价低于成本，仍要导出吗？',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false),
    })
  })
}

async function onExport(format) {
  if (exportState.loading) return
  // 复用现有规则：多式联运至少 2 种，否则报价本身无效
  if (isMultimodal.value && form.multimodal.length < 2) {
    uni.showToast({ title: '多式联运至少选 2 种', icon: 'none' })
    return
  }
  const go = await confirmBelowCost()
  if (!go) return

  exportState.loading = true
  exportState.format = format
  try {
    const url = buildQuoteDocUrl(buildExportPayload(format))

    // #ifdef H5
    // 浏览器直接打开：可预览 / 下载 / 打印
    window.open(url, '_blank')
    // #endif

    // #ifdef MP-WEIXIN
    const filePath = await downloadQuoteDoc(url)
    if (format === 'png') {
      await saveImageToAlbum(filePath)
      uni.showToast({ title: '已保存到相册，可直接发给客户', icon: 'none' })
    } else {
      await openPdfDoc(filePath)
    }
    // #endif
  } catch (e) {
    // 已自行给出引导（如相册授权）的错误不再重复弹窗
    if (!(e && e.handled)) {
      uni.showModal({
        title: '导出失败',
        content: (e && e.message) || '导出失败，请稍后重试',
        showCancel: false,
      })
    }
  } finally {
    exportState.loading = false
    exportState.format = ''
  }
}

// #ifdef MP-WEIXIN
// 下载生成的图片 / PDF 到临时文件；失败时读出后端返回的 message，不吞错误
function downloadQuoteDoc(url) {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.tempFilePath)
        } else {
          readDownloadError(res.tempFilePath, res.statusCode).then((msg) => reject(new Error(msg)))
        }
      },
      fail: (err) => reject(new Error((err && err.errMsg) || '下载失败')),
    })
  })
}

// downloadFile 非 2xx 时仍会落盘，错误正文需从文件里读出来
function readDownloadError(filePath, statusCode) {
  const fallback = '导出失败（HTTP ' + statusCode + '）'
  return new Promise((resolve) => {
    if (!filePath) return resolve(fallback)
    uni.getFileSystemManager().readFile({
      filePath,
      encoding: 'utf8',
      success: (r) => {
        let msg = ''
        try {
          const j = JSON.parse(r.data)
          msg = j.message || j.error || ''
        } catch (e) {
          msg = (r.data || '').slice(0, 200)
        }
        resolve(msg || fallback)
      },
      fail: () => resolve(fallback),
    })
  })
}

// 保存到相册；用户拒绝授权时给出明确提示并引导去设置页开启
function saveImageToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: (err) => {
        const msg = (err && err.errMsg) || ''
        if (/auth|authorize|permission|deny/i.test(msg)) {
          const e = new Error('')
          e.handled = true
          uni.showModal({
            title: '需要相册权限',
            content: '保存图片需要「保存到相册」权限，是否前往设置开启？',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) uni.openSetting({})
            },
          })
          reject(e)
        } else if (/cancel/i.test(msg)) {
          const e = new Error('')
          e.handled = true
          reject(e)
        } else {
          reject(new Error(msg || '保存到相册失败'))
        }
      },
    })
  })
}

// 打开 PDF：右上角菜单可转发给客户
function openPdfDoc(filePath) {
  return new Promise((resolve, reject) => {
    uni.openDocument({
      filePath,
      fileType: 'pdf',
      showMenu: true,
      success: () => resolve(),
      fail: (err) => reject(new Error((err && err.errMsg) || '打开 PDF 失败')),
    })
  })
}
// #endif
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

/* ---- 产品明细：每行一张小卡 ---- */
.item-card {
  margin-top: 16rpx;
  padding: 16rpx 16rpx 8rpx;
  background: #f9fafb;
  border: 1rpx solid #eef0f3;
  border-radius: 12rpx;
}
.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4rpx;
}
.item-no {
  font-size: 26rpx;
  font-weight: 600;
  color: #2563eb;
}
.item-del {
  font-size: 24rpx;
  color: #dc2626;
  padding: 4rpx 12rpx;
}
/* 只剩 1 行时不可删：置灰但仍可点击（点击给提示） */
.item-del-off {
  color: #cbd5e1;
}
.add-item {
  margin-top: 16rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
  color: #2563eb;
  background: #eff6ff;
  border: 1rpx dashed #bfdbfe;
  border-radius: 12rpx;
  padding: 20rpx 0;
}

/* ---- 结果区明细表（# / 产品名 / 数量 / 单价 / 金额） ---- */
.item-table {
  margin-top: 12rpx;
  border-top: 1rpx solid #f0f1f3;
}
.item-row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f0f1f3;
  font-size: 26rpx;
  color: #111827;
}
.item-row-head {
  font-size: 22rpx;
  color: #9ca3af;
  border-bottom-color: #e5e7eb;
}
.item-row-total {
  font-weight: 600;
  border-bottom: none;
}
.it-no {
  width: 44rpx;
  flex-shrink: 0;
  color: #9ca3af;
}
.it-name {
  flex: 1;
  min-width: 0;
  padding-right: 12rpx;
  /* 超长产品名省略号截断 */
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.it-qty {
  width: 120rpx;
  flex-shrink: 0;
  text-align: right;
}
.it-price {
  width: 140rpx;
  flex-shrink: 0;
  text-align: right;
}
.it-amount {
  width: 180rpx;
  flex-shrink: 0;
  text-align: right;
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

/* ---- 导出报价单入口按钮 ---- */
.btn-export {
  margin-top: 20rpx;
  background: #0f766e;
}

/* ---- 导出面板（页面内弹层，不引 UI 库） ---- */
.export-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(17, 24, 39, 0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}
.export-panel {
  width: 100%;
  max-height: 86vh;
  background: #ffffff;
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  display: flex;
  flex-direction: column;
}
.export-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx 16rpx;
  border-bottom: 1rpx solid #f0f1f3;
}
.export-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
}
.export-close {
  font-size: 32rpx;
  line-height: 1;
  color: #9ca3af;
  padding: 4rpx 12rpx;
}
.export-body {
  /* 小程序 scroll-view 需显式高度才能滚动 */
  height: 68vh;
  padding: 8rpx 24rpx 32rpx;
  box-sizing: border-box;
}
.export-section {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
  padding: 24rpx 0 8rpx;
}
.export-hint-line {
  font-size: 22rpx;
  line-height: 1.5;
  color: #9ca3af;
  padding-bottom: 8rpx;
}
.export-btn {
  margin-top: 24rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
  background: #2563eb;
  border-radius: 12rpx;
  padding: 24rpx 0;
}
.export-btn-ghost {
  background: #eef2ff;
  color: #2563eb;
}
.export-btn-disabled {
  opacity: 0.55;
}
.export-btn-note {
  font-size: 22rpx;
  line-height: 1.5;
  color: #9ca3af;
  text-align: center;
  padding-top: 8rpx;
}
</style>
