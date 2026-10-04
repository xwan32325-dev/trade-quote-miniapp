<!-- 装柜计算页：按箱规与柜型估算可装箱数，并给出多柜分配、柜型对比与装柜方案 -->
<template>
  <view class="page">
    <!-- 来自报价页的件数提示：有数据时才显示，一键带入「总件数」 -->
    <view class="quote-banner" v-if="quoteInfo.qty > 0">
      <text class="quote-banner-text">来自报价页：{{ fmt(quoteInfo.qty, 0) }} 件（{{ quoteInfo.count }} 个产品）</text>
      <text class="quote-banner-btn" @click="onImportQuoteQty">带入</text>
    </view>

    <view class="card">
      <view class="card-title">单箱尺寸与重量</view>
      <view class="field">
        <text class="field-label">长</text>
        <input class="field-input" type="digit" v-model="form.length" />
        <text class="field-unit">cm</text>
      </view>
      <view class="field">
        <text class="field-label">宽</text>
        <input class="field-input" type="digit" v-model="form.width" />
        <text class="field-unit">cm</text>
      </view>
      <view class="field">
        <text class="field-label">高</text>
        <input class="field-input" type="digit" v-model="form.height" />
        <text class="field-unit">cm</text>
      </view>
      <view class="field">
        <text class="field-label">单箱毛重</text>
        <input class="field-input" type="digit" v-model="form.grossWeight" />
        <text class="field-unit">kg</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title">柜型与装载率</view>
      <picker mode="selector" :range="containerLabels" :value="containerIndex" @change="onContainerChange">
        <view class="field">
          <text class="field-label">柜型</text>
          <text class="field-value">{{ form.containerType }} ›</text>
        </view>
      </picker>
      <view class="field">
        <text class="field-label">装载率</text>
        <input class="field-input" type="digit" v-model="form.loadRate" />
        <text class="field-unit">%</text>
      </view>
      <view class="muted">
        参考容积：内容积 {{ result.innerVolume }} CBM / 实际可用 {{ result.usableVolume }} CBM / 限重 {{ result.maxWeight }} kg
      </view>
      <view class="muted">
        内尺寸：{{ result.innerLength }} × {{ result.innerWidth }} × {{ result.innerHeight }} cm
      </view>
    </view>

    <!-- 货量：算「这批货要几个柜」的输入；三项都可留空 -->
    <view class="card">
      <view class="card-title">货量</view>
      <view class="field">
        <text class="field-label">总件数</text>
        <input class="field-input" type="digit" v-model="form.totalQty" placeholder="可留空" />
        <text class="field-unit">件</text>
      </view>
      <view class="field">
        <text class="field-label">每箱件数</text>
        <input class="field-input" type="digit" v-model="form.perBoxQty" placeholder="可留空" />
        <text class="field-unit">件/箱</text>
      </view>
      <view class="field">
        <text class="field-label">总箱数</text>
        <input class="field-input" type="digit" v-model="form.totalBoxes" placeholder="可留空" />
        <text class="field-unit">箱</text>
      </view>
      <view class="muted" v-if="totalBoxes > 0">按当前填写：共 {{ fmt(totalBoxes, 0) }} 箱</view>
      <view class="muted" v-else>填「总箱数」即以它为准；只填「总件数 + 每箱件数」则按 件数 ÷ 每箱件数 向上取整</view>
    </view>

    <view class="card">
      <view class="card-title">计算结果</view>
      <view class="big-number">{{ result.boxes }} <text class="big-unit">箱</text></view>
      <view class="limit-tip" :class="result.limitBy === 'volume' ? 'loss' : result.limitBy === 'weight' ? 'profit' : ''">
        {{ limitText }}
      </view>
      <view class="result-line">
        <text class="field-label">单箱体积</text>
        <text class="result-value">{{ fmt(result.boxVolume, 4) }} CBM</text>
      </view>
      <view class="result-line">
        <text class="field-label">体积可装</text>
        <text class="result-value">{{ result.volumeBoxes }} 箱</text>
      </view>
      <view class="result-line">
        <text class="field-label">几何码放</text>
        <text class="result-value">{{ packText }}</text>
      </view>
      <view class="result-line">
        <text class="field-label">重量可装</text>
        <text class="result-value">{{ result.weightBoxes }} 箱</text>
      </view>
      <view class="result-line">
        <text class="field-label">总方数</text>
        <text class="result-value">{{ fmt(result.totalVolume, 2) }} CBM</text>
      </view>
      <view class="result-line">
        <text class="field-label">总毛重</text>
        <text class="result-value">{{ fmt(result.totalWeight, 2) }} kg</text>
      </view>
      <view class="result-line">
        <text class="field-label">容积利用率</text>
        <text class="result-value">{{ fmt(result.utilization, 2) }}%</text>
      </view>

      <!-- 需要几个柜：有货量时才给多柜结果 -->
      <view class="multi" v-if="plan.count > 0">
        <view class="multi-main">
          需要 <text class="multi-num">{{ plan.count }}</text> 个 {{ result.containerType }}
        </view>
        <view class="multi-row multi-row-head">
          <text class="mc-no"></text>
          <text class="mc-box">箱数</text>
          <text class="mc-vol">方数</text>
          <text class="mc-kg">毛重</text>
          <text class="mc-rate">利用率</text>
        </view>
        <view class="multi-row" v-for="row in containerRows" :key="row.index" :class="{ 'multi-row-last': row.isLast }">
          <text class="mc-no">柜 {{ row.index }}</text>
          <text class="mc-box">{{ fmt(row.boxes, 0) }}</text>
          <text class="mc-vol">{{ fmt(row.volume, 1) }}</text>
          <text class="mc-kg">{{ fmt(row.weight, 0) }}</text>
          <text class="mc-rate">{{ fmt(row.utilization, 0) }}%</text>
        </view>
        <view class="multi-row multi-row-total">
          <text class="mc-no">合计</text>
          <text class="mc-box">{{ fmt(shipment.boxes, 0) }}</text>
          <text class="mc-vol">{{ fmt(shipment.volume, 1) }}</text>
          <text class="mc-kg">{{ fmt(shipment.weight, 0) }}</text>
          <text class="mc-rate">—</text>
        </view>
      </view>

      <!-- 柜型对比：同样货量各柜型需要几个，按柜数升序 → 柜型从小到大 -->
      <view class="compare" v-if="plan.count > 0">
        <view class="compare-title">柜型对比（需 {{ fmt(totalBoxes, 0) }} 箱）</view>
        <view class="compare-grid">
          <view
            class="compare-cell"
            v-for="c in comparison"
            :key="c.type"
            :class="{ 'compare-cell-on': c.type === form.containerType }"
            @click="onPickContainer(c.type)"
          >
            <text class="compare-type">{{ c.type }}</text>
            <text class="compare-count">{{ c.count > 0 ? c.count + ' 个' : '装不下' }}</text>
          </view>
        </view>
      </view>

      <!-- 结果卡片底部：复制 / 保存（样式与报价页一致） -->
      <view class="row actions">
        <view class="btn" @click="onSave">保存到记录</view>
        <view class="btn btn-ghost" @click="onCopy">复制装柜方案</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, computed, watch, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  calcLoading,
  deriveTotalBoxes,
  planContainers,
  compareContainers,
  formatNumber,
  safeNumber,
  CONTAINERS,
} from '../../utils/calc.js'
import { saveForm, loadForm, saveRecord, makeId } from '../../utils/storage.js'

const containerKeys = Object.keys(CONTAINERS)

const form = reactive({
  length: 50,
  width: 40,
  height: 30,
  grossWeight: 12,
  containerType: '20GP',
  loadRate: 85,
  totalQty: '',
  perBoxQty: '',
  totalBoxes: '',
})

// ---- 表单记忆：箱规 / 柜型 / 装载率 / 货量 ----
const MEMO_KEYS = [
  'length', 'width', 'height', 'grossWeight',
  'containerType', 'loadRate',
  'totalQty', 'perBoxQty', 'totalBoxes',
]

watch(
  form,
  () => {
    const payload = {}
    MEMO_KEYS.forEach((k) => {
      payload[k] = form[k]
    })
    saveForm('loading', payload)
  },
  { deep: true },
)

onMounted(() => {
  const saved = loadForm('loading')
  if (saved) {
    MEMO_KEYS.forEach((k) => {
      if (saved[k] !== undefined && saved[k] !== null) form[k] = saved[k]
    })
    // 老记忆里的柜型可能已失效，回退默认 20GP
    if (!CONTAINERS[form.containerType]) form.containerType = '20GP'
  }
})

const containerLabels = containerKeys.map((k) => CONTAINERS[k].label)
const containerIndex = computed(() => Math.max(0, containerKeys.indexOf(form.containerType)))

const result = computed(() => calcLoading(form))

// ---- 多柜：总箱数 → 需要几个柜 / 每柜明细 ----
const totalBoxes = computed(() => deriveTotalBoxes(form))
const plan = computed(() => planContainers(totalBoxes.value, result.value.boxes))

const containerRows = computed(() => {
  const r = result.value
  const list = plan.value.list
  return list.map((n, i) => ({
    index: i + 1,
    boxes: n,
    volume: n * r.boxVolume,
    weight: n * r.grossWeight,
    utilization: r.usableVolume > 0 ? ((n * r.boxVolume) / r.usableVolume) * 100 : 0,
    isLast: i === list.length - 1 && n < r.boxes,
  }))
})

const shipment = computed(() => ({
  boxes: totalBoxes.value,
  volume: totalBoxes.value * result.value.boxVolume,
  weight: totalBoxes.value * result.value.grossWeight,
}))

const comparison = computed(() =>
  compareContainers(
    {
      length: form.length,
      width: form.width,
      height: form.height,
      grossWeight: form.grossWeight,
      loadRate: form.loadRate,
    },
    totalBoxes.value,
  ),
)

// ---- 来自报价页：读取 form:quote 的件数合计 ----
const quoteInfo = ref({ qty: 0, count: 0 })

function refreshQuoteInfo() {
  const q = loadForm('quote')
  const items = q && Array.isArray(q.items) ? q.items : []
  const qty = items.reduce((s, it) => s + safeNumber(it && it.qty), 0)
  quoteInfo.value = { qty, count: items.length }
}
onShow(refreshQuoteInfo)

function onImportQuoteQty() {
  form.totalQty = quoteInfo.value.qty
}

function onPickContainer(type) {
  if (CONTAINERS[type]) form.containerType = type
}

const packText = computed(() => {
  const r = result.value
  const p = r.packLayout || { x: 0, y: 0, z: 0 }
  return `${p.x} × ${p.y} × ${p.z} = ${r.packBoxes} 箱`
})

const limitText = computed(() => {
  const r = result.value
  if (r.limitBy === 'packing') {
    const p = r.packLayout || { x: 0, y: 0, z: 0 }
    return `受码放限制（几何最优 ${p.x} × ${p.y} × ${p.z} = ${r.packBoxes} 箱｜体积可装 ${r.volumeBoxes}｜重量可装 ${fmt(r.weightBoxes, 0)}）`
  }
  if (r.limitBy === 'volume') {
    return `受体积限制（体积可装 ${r.volumeBoxes} 箱｜几何码放 ${r.packBoxes}｜重量可装 ${fmt(r.weightBoxes, 0)}）`
  }
  if (r.limitBy === 'weight') {
    return `受重量限制（重量可装 ${fmt(r.weightBoxes, 0)} 箱｜体积可装 ${r.volumeBoxes}｜几何码放 ${r.packBoxes}）`
  }
  return '请填写箱规与重量'
})

// 限制因素：复制文本里的一行
function limitFactorText() {
  const r = result.value
  if (r.limitBy === 'packing') {
    const p = r.packLayout || { x: 0, y: 0, z: 0 }
    return `码放（几何最优 ${p.x} × ${p.y} × ${p.z} = ${r.packBoxes} 箱）`
  }
  if (r.limitBy === 'volume') return `体积（体积可装 ${r.volumeBoxes} 箱）`
  if (r.limitBy === 'weight') return `重量（重量可装 ${fmt(r.weightBoxes, 0)} 箱）`
  return '—'
}

function fmt(v, decimals = 2) {
  return formatNumber(v, decimals)
}

// 箱规里的数字：去掉无意义的小数尾零（50.00 → 50）
function dim(v) {
  const n = safeNumber(v)
  return String(Number(n.toFixed(4)))
}

// 装柜方案全文（复制 / 保存共用）
function buildText() {
  const r = result.value
  const lines = [
    '【装柜方案】',
    `箱规：${dim(form.length)} × ${dim(form.width)} × ${dim(form.height)} cm，单箱毛重 ${dim(form.grossWeight)} kg`,
    `柜型：${r.containerType}`,
    `可装：${r.boxes} 箱 / ${fmt(r.totalVolume, 2)} CBM / ${fmt(r.totalWeight, 2)} kg / 利用率 ${fmt(r.utilization, 2)}%`,
    `限制因素：${limitFactorText()}`,
  ]
  if (plan.value.count > 0) {
    const last = plan.value.list[plan.value.list.length - 1]
    lines.push(`货量：${fmt(totalBoxes.value, 0)} 箱 → 需要 ${plan.value.count} 个 ${r.containerType}（最后一柜 ${last} 箱）`)
  }
  return lines.join('\n')
}

function onCopy() {
  uni.setClipboardData({
    data: buildText(),
    success: () => uni.showToast({ title: '已复制', icon: 'success' }),
  })
}

function onSave() {
  const r = result.value
  const last = plan.value.count > 0 ? plan.value.list[plan.value.list.length - 1] : 0
  const record = {
    id: makeId(),
    type: 'loading',
    title: `${r.containerType} · ${r.boxes} 箱`,
    containerType: r.containerType,
    containerLabel: r.containerLabel,
    length: safeNumber(form.length),
    width: safeNumber(form.width),
    height: safeNumber(form.height),
    grossWeight: safeNumber(form.grossWeight),
    loadRate: r.loadRate,
    boxes: r.boxes,
    boxVolume: r.boxVolume,
    volumeBoxes: r.volumeBoxes,
    packBoxes: r.packBoxes,
    packLayout: { ...r.packLayout },
    weightBoxes: r.weightBoxes,
    totalVolume: r.totalVolume,
    totalWeight: r.totalWeight,
    utilization: r.utilization,
    limitBy: r.limitBy,
    totalBoxes: totalBoxes.value,
    containerCount: plan.value.count,
    containerPlan: [...plan.value.list],
    lastContainerBoxes: last,
    text: buildText(),
    createdAt: Date.now(),
  }
  saveRecord(record)
  uni.showToast({ title: '已保存', icon: 'success' })
}

function onContainerChange(e) {
  form.containerType = containerKeys[e.detail.value]
}
</script>

<style scoped>
/* 来自报价页的件数提示条 */
.quote-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  background: #eff6ff;
  border: 1rpx solid #bfdbfe;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 24rpx;
}
.quote-banner-text {
  flex: 1;
  font-size: 26rpx;
  color: #2563eb;
}
.quote-banner-btn {
  flex-shrink: 0;
  font-size: 26rpx;
  color: #ffffff;
  background: #2563eb;
  border-radius: 8rpx;
  padding: 8rpx 24rpx;
}

.field-value {
  color: #111827;
  font-weight: 600;
}
.big-number {
  font-size: 72rpx;
  font-weight: 700;
  color: #2563eb;
  text-align: center;
  margin: 10rpx 0;
}
.big-unit {
  font-size: 30rpx;
  color: #6b7280;
  font-weight: 400;
}
.limit-tip {
  text-align: center;
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 20rpx;
}

/* ---- 需要几个柜 ---- */
.multi {
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx dashed #e5e7eb;
}
.multi-main {
  text-align: center;
  font-size: 32rpx;
  color: #111827;
  padding-bottom: 16rpx;
}
.multi-num {
  font-size: 40rpx;
  font-weight: 700;
  color: #2563eb;
  padding: 0 6rpx;
}
.multi-row {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
  font-size: 24rpx;
  color: #111827;
  border-bottom: 1rpx solid #f0f1f3;
}
.multi-row-head {
  font-size: 22rpx;
  color: #9ca3af;
  border-bottom-color: #e5e7eb;
}
.multi-row-last {
  color: #d97706;
}
.multi-row-total {
  font-weight: 600;
  border-bottom: none;
}
.mc-no {
  width: 120rpx;
  flex-shrink: 0;
}
.mc-box {
  flex: 1;
  text-align: right;
}
.mc-vol {
  flex: 1;
  text-align: right;
}
.mc-kg {
  flex: 1;
  text-align: right;
}
.mc-rate {
  flex: 1;
  text-align: right;
}

/* ---- 柜型对比 ---- */
.compare {
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx dashed #e5e7eb;
}
.compare-title {
  font-size: 26rpx;
  color: #4b5563;
  padding-bottom: 12rpx;
}
.compare-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.compare-cell {
  min-width: 140rpx;
  flex: 1;
  text-align: center;
  background: #f7f8fa;
  border: 1rpx solid #eef0f3;
  border-radius: 12rpx;
  padding: 14rpx 8rpx;
}
.compare-cell-on {
  background: #eff6ff;
  border-color: #2563eb;
}
.compare-type {
  display: block;
  font-size: 24rpx;
  color: #4b5563;
}
.compare-count {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #111827;
  padding-top: 4rpx;
}
.compare-cell-on .compare-type,
.compare-cell-on .compare-count {
  color: #2563eb;
}

/* 结果卡片底部按钮 */
.actions {
  margin-top: 28rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f1f3;
}
</style>
