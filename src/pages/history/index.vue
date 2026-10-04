<!-- 我的记录页：查看历史报价，支持按日期筛选、展开详情、删除单条、清空全部 -->
<template>
  <view class="page">
    <!-- 有记录：筛选状态行 + 清空全部 -->
    <view class="card" v-if="allList.length">
      <view class="status-row">
        <text class="status-text">{{ statusText }}</text>
        <text class="link" v-if="filterActive" @click="clearFilter">清除筛选</text>
      </view>
      <view class="row">
        <view class="btn btn-danger" @click="onClear">清空全部</view>
      </view>
    </view>

    <!-- 完全无记录 -->
    <view class="card" v-if="!allList.length">
      <view class="empty">还没有保存的记录</view>
      <view class="muted" style="text-align: center">到「报价」或「装柜」页填入参数并点击「保存到记录」即可。</view>
    </view>

    <!-- 有记录但当前筛选结果为空 -->
    <view class="card" v-if="allList.length && !filteredList.length">
      <view class="empty">该时间段没有记录</view>
      <view class="empty-actions">
        <view class="btn btn-ghost" @click="clearFilter">清除筛选</view>
      </view>
    </view>

    <view class="card" v-for="item in filteredList" :key="item.id">
      <view @click="toggle(item.id)">
        <view class="record-head">
          <text class="record-title">{{ titleOf(item) }}</text>
          <text class="muted">{{ formatTime(item.createdAt) }}</text>
        </view>
        <!-- 装柜记录：只展示箱数 / 方数 / 毛重 -->
        <template v-if="isLoading(item)">
          <view class="record-summary">
            <text>{{ fmt(item.boxes, 0) }} 箱</text>
            <text>{{ fmt(item.totalVolume, 2) }} CBM / {{ fmt(item.totalWeight, 0) }} kg</text>
          </view>
        </template>
        <!-- 报价记录：保持原有逻辑 -->
        <template v-else>
          <view class="muted" v-if="item.customerName">客户：{{ item.customerName }}</view>
          <view class="muted">运输方式：{{ transportText(item) }}</view>
          <view class="record-summary">
            <text v-if="itemsOf(item).length <= 1">{{ termOf(item) }} 单价 {{ codeOf(item) }} {{ fmt(item.unitPrice, unitDecimalsOf(item)) }}</text>
            <text v-else>{{ termOf(item) }} 整单（{{ itemsOf(item).length }} 项）</text>
            <text>总价 {{ codeOf(item) }} {{ fmt(item.totalPrice) }}</text>
          </view>
        </template>
      </view>

      <view class="detail" v-if="expandedId === item.id">
        <!-- 装柜记录详情：与复制文本一致的字段 -->
        <template v-if="isLoading(item)">
          <view class="result-line">
            <text class="field-label">箱规</text>
            <text class="result-value">{{ dim(item.length) }} × {{ dim(item.width) }} × {{ dim(item.height) }} cm / {{ dim(item.grossWeight) }} kg</text>
          </view>
          <view class="result-line">
            <text class="field-label">柜型</text>
            <text class="result-value">{{ item.containerType }}</text>
          </view>
          <view class="result-line">
            <text class="field-label">可装</text>
            <text class="result-value">{{ fmt(item.boxes, 0) }} 箱 / {{ fmt(item.totalVolume, 2) }} CBM / {{ fmt(item.totalWeight, 2) }} kg / 利用率 {{ fmt(item.utilization, 2) }}%</text>
          </view>
          <view class="result-line">
            <text class="field-label">限制因素</text>
            <text class="result-value">{{ limitFactorOf(item) }}</text>
          </view>
          <view class="result-line" v-if="item.totalBoxes > 0 && item.containerCount > 0">
            <text class="field-label">货量</text>
            <text class="result-value">{{ fmt(item.totalBoxes, 0) }} 箱 → 需要 {{ item.containerCount }} 个 {{ item.containerType }}（最后一柜 {{ item.lastContainerBoxes }} 箱）</text>
          </view>
        </template>
        <!-- 报价记录详情：保持原有逻辑 -->
        <template v-else>
          <view class="result-line">
            <text class="field-label">贸易方式</text>
            <text class="result-value">{{ termLabel(termOf(item)) }}</text>
          </view>
          <view class="result-line" v-if="itemsOf(item).length <= 1">
            <text class="field-label">{{ termOf(item) }} 单价</text>
            <text class="result-value">{{ codeOf(item) }} {{ fmt(item.unitPrice, unitDecimalsOf(item)) }} / 件</text>
          </view>
          <view class="result-line">
            <text class="field-label">{{ termOf(item) }} 整单总价</text>
            <text class="result-value">{{ codeOf(item) }} {{ fmt(item.totalPrice) }}</text>
          </view>
          <!-- 多产品：逐行列出分摊后的明细 -->
          <view class="items" v-if="itemsOf(item).length > 1">
            <view class="item-line" v-for="(row, i) in itemsOf(item)" :key="i">
              <text class="item-name">{{ i + 1 }}. {{ row.productName || '未命名产品' }}</text>
              <text class="item-calc">{{ fmt(row.qty, 0) }} 件 × {{ codeOf(item) }} {{ fmt(row.unitPrice, row.decimals) }} = {{ codeOf(item) }} {{ fmt(row.totalPrice) }}</text>
            </view>
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
          <view class="muted" style="margin-top: 12rpx">输入：{{ inputText(item) }}</view>
        </template>
        <view class="row" style="margin-top: 20rpx">
          <view class="btn btn-danger" @click.stop="onDelete(item.id)">删除这条</view>
        </view>
      </view>
    </view>

    <!-- 贴边悬浮球：默认半藏在右侧，可上下拖动，点击展开筛选面板 -->
    <movable-area class="ball-area" v-if="!panelOpen" :style="areaStyle">
      <movable-view
        class="ball"
        direction="vertical"
        :y="ballY"
        :damping="40"
        @touchstart="onBallTouchStart"
        @touchend="onBallTouchEnd"
        @change="onBallChange"
      >
        <view class="ball-inner" @click="onBallClick">
          <text class="ball-text">筛</text>
          <text class="ball-text">选</text>
          <view class="ball-dot" v-if="filterActive"></view>
        </view>
      </movable-view>
    </movable-area>

    <!-- 日期筛选面板 -->
    <view class="filter-mask" v-if="panelOpen" @click="closePanel"></view>
    <view class="filter-sheet" v-if="panelOpen" @click.stop>
      <view class="sheet-head">
        <text class="sheet-title">按日期筛选</text>
        <text class="sheet-close" @click="closePanel">✕</text>
      </view>
      <view class="sheet-preview">{{ previewText }}</view>

      <view class="chips">
        <view
          class="chip"
          v-for="q in QUICK"
          :key="q.id"
          :class="{ active: filter.quick === q.id }"
          @click="pickQuick(q.id)"
        >{{ q.label }}</view>
      </view>

      <view class="range">
        <picker mode="date" :value="pickerStart" @change="onPickStart">
          <view class="range-field">
            <text class="range-label">开始</text>
            <text class="range-value" :class="{ ph: !filter.start }">{{ filter.start || '请选择' }}</text>
          </view>
        </picker>
        <picker mode="date" :value="pickerEnd" @change="onPickEnd">
          <view class="range-field">
            <text class="range-label">结束</text>
            <text class="range-value" :class="{ ph: !filter.end }">{{ filter.end || '请选择' }}</text>
          </view>
        </picker>
      </view>

      <view class="row">
        <view class="btn btn-ghost" @click="resetFilter">重置</view>
        <view class="btn" @click="closePanel">确定</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getHistory, removeRecord, clearHistory } from '../../utils/storage.js'
import { formatNumber } from '../../utils/calc.js'
import { getCurrency } from '../../utils/currency.js'
import { MULTIMODAL, modeShortName } from '../../utils/transport.js'
import { termLabel, termIncludes } from '../../utils/incoterms.js'

const BALL_STORAGE_KEY = 'history:ball'
const FILTER_STORAGE_KEY = 'history:filter'

// 快捷选项：相对今天计算，存 id 即可在下次进入时重算
const QUICK = [
  { id: 'today', label: '今天' },
  { id: '7d', label: '近 7 天' },
  { id: '30d', label: '近 30 天' },
  { id: 'month', label: '本月' },
  { id: 'all', label: '全部' },
]
const QUICK_IDS = QUICK.map((q) => q.id)

const allList = ref([])
const expandedId = ref('')
const panelOpen = ref(false)

// 筛选条件：quick（快捷 id）或自定义 start/end（YYYY-MM-DD）
const filter = ref({ quick: 'all', start: '', end: '' })

function load() {
  allList.value = getHistory()
}

// 每次进入页面刷新，保证新保存的记录可见
onShow(load)

// ---- 日期工具 ----
function pad(n) {
  return n < 10 ? '0' + n : '' + n
}
function dayOf(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function todayStr() {
  return dayOf(Date.now())
}
// 以「天」为单位平移，避免跨月/跨年手动算
function shiftDay(dayStr, delta) {
  const [y, m, d] = dayStr.split('-').map(Number)
  return dayOf(new Date(y, m - 1, d + delta).getTime())
}

// 把筛选条件解析成 { start, end } 天字符串；全部返回 null
const range = computed(() => {
  const f = filter.value
  if (f.quick === 'today') {
    const t = todayStr()
    return { start: t, end: t }
  }
  if (f.quick === '7d') {
    const t = todayStr()
    return { start: shiftDay(t, -6), end: t }
  }
  if (f.quick === '30d') {
    const t = todayStr()
    return { start: shiftDay(t, -29), end: t }
  }
  if (f.quick === 'month') {
    const t = todayStr()
    const [y, m] = t.split('-').map(Number)
    return { start: `${y}-${pad(m)}-01`, end: dayOf(new Date(y, m, 0).getTime()) }
  }
  if (f.start || f.end) {
    let s = f.start
    let e = f.end
    if (s && e && s > e) {
      const tmp = s
      s = e
      e = tmp
    }
    return { start: s, end: e }
  }
  return null
})

const filterActive = computed(() => range.value !== null)

// 按 createdAt 过滤，含首尾当天（当天以 00:00:00~23:59:59 计，用日期串比较天然包含）
const filteredList = computed(() => {
  const r = range.value
  if (!r) return allList.value
  return allList.value.filter((item) => {
    const day = dayOf(Number(item.createdAt))
    if (r.start && day < r.start) return false
    if (r.end && day > r.end) return false
    return true
  })
})

// 当前筛选的简短文案（用于状态行）
const rangeLabel = computed(() => {
  const f = filter.value
  if (f.quick === 'today') return '今天'
  if (f.quick === '7d') return '最近 7 天'
  if (f.quick === '30d') return '最近 30 天'
  if (f.quick === 'month') return '本月'
  return ''
})

// 状态行：共 N 条 · 筛选：xxx
const statusText = computed(() => {
  const n = filteredList.value.length
  if (!filterActive.value) return `共 ${n} 条记录`
  const minus = rangeLabel.value || spanOf(range.value)
  return `共 ${n} 条记录 · 筛选：${minus}`
})

function spanOf(r) {
  if (!r) return ''
  if (r.start && r.end) return r.start === r.end ? r.start : `${r.start} ~ ${r.end}`
  if (r.start) return `${r.start} 起`
  return `截至 ${r.end}`
}

// 面板顶部说明：范围 · 条数
const previewText = computed(() => {
  const n = filteredList.value.length
  const r = range.value
  if (!r) return `全部 · 共 ${n} 条`
  return `${spanOf(r)} · 共 ${n} 条`
})

// picker 的 value 不能为空，未选时回退今天
const pickerStart = computed(() => filter.value.start || todayStr())
const pickerEnd = computed(() => filter.value.end || todayStr())

// ---- 筛选条件读写与持久化 ----
function loadFilter() {
  try {
    const v = uni.getStorageSync(FILTER_STORAGE_KEY)
    if (v && typeof v === 'object') {
      const quick = QUICK_IDS.includes(v.quick) ? v.quick : ''
      const start = typeof v.start === 'string' ? v.start : ''
      const end = typeof v.end === 'string' ? v.end : ''
      filter.value = { quick: quick || (start || end ? '' : 'all'), start, end }
    }
  } catch (e) {
    // 读不到就用默认「全部」
  }
}
loadFilter()

function persistFilter() {
  try {
    uni.setStorageSync(FILTER_STORAGE_KEY, { ...filter.value })
  } catch (e) {}
}

// 快捷选项单选；选中即清掉自定义起止
function pickQuick(id) {
  filter.value = { quick: id, start: '', end: '' }
  persistFilter()
}

// 自定义起始日；与结束日颠倒时自动交换
function onPickStart(e) {
  let s = e.detail.value
  let end = filter.value.end
  if (end && s > end) {
    const tmp = s
    s = end
    end = tmp
  }
  filter.value = { quick: '', start: s, end }
  persistFilter()
}

// 自定义结束日；与起始日颠倒时自动交换
function onPickEnd(e) {
  let s = filter.value.start
  let end = e.detail.value
  if (s && s > end) {
    const tmp = s
    s = end
    end = tmp
  }
  filter.value = { quick: '', start: s, end }
  persistFilter()
}

// 清除筛选 / 重置：都回到「全部」
function clearFilter() {
  filter.value = { quick: 'all', start: '', end: '' }
  persistFilter()
}
const resetFilter = clearFilter

// ---- 悬浮球：拖动位置与点击区分 ----
const sys = uni.getSystemInfoSync()
const BALL_PX = (96 * sys.windowWidth) / 750
const AREA_TOP_PX = (240 * sys.windowWidth) / 750
const AREA_BOTTOM_RESERVE_PX = (170 * sys.windowWidth) / 750
const areaH = Math.max(BALL_PX + 40, sys.windowHeight - AREA_TOP_PX - AREA_BOTTOM_RESERVE_PX)
const maxBallY = Math.max(0, areaH - BALL_PX)

const ballY = ref(clampBallY(Number(uni.getStorageSync(BALL_STORAGE_KEY))))
function clampBallY(y) {
  if (!Number.isFinite(y) || y <= 0) return Math.round(maxBallY * 0.62)
  return Math.min(Math.max(0, y), maxBallY)
}

const areaStyle = computed(() => ({
  top: AREA_TOP_PX + 'px',
  height: areaH + 'px',
}))

let gestureStartY = 0 // 本次手势开始时球的 y（px）
let touchStartY = 0 // 手指按下时的 clientY（px）
const dragMoved = ref(false)

function onBallTouchStart(e) {
  dragMoved.value = false
  gestureStartY = ballY.value
  touchStartY = e.touches && e.touches[0] ? e.touches[0].clientY : 0
}

function onBallChange(e) {
  ballY.value = e.detail.y
  if (Math.abs(e.detail.y - gestureStartY) > 8) dragMoved.value = true
}

function onBallTouchEnd(e) {
  const endY = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : touchStartY
  if (Math.abs(endY - touchStartY) > 8) dragMoved.value = true
  persistBall()
}

function onBallClick() {
  if (!dragMoved.value) openPanel()
}

function persistBall() {
  try {
    uni.setStorageSync(BALL_STORAGE_KEY, ballY.value)
  } catch (e) {}
}

function openPanel() {
  panelOpen.value = true
}
function closePanel() {
  panelOpen.value = false
}

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

// 记录明细：新记录有 items[]；旧记录无（或空）时按空数组处理
function itemsOf(item) {
  return item && Array.isArray(item.items) ? item.items : []
}

// 装柜记录判定：老报价记录无 type 或 type='quote' 一律按报价渲染
function isLoading(item) {
  return !!(item && item.type === 'loading')
}

// 装柜详情里的「限制因素」文案（与装柜页复制文本一致）
function limitFactorOf(item) {
  const p = (item && item.packLayout) || { x: 0, y: 0, z: 0 }
  if (item.limitBy === 'packing') return `码放（几何最优 ${p.x} × ${p.y} × ${p.z} = ${item.packBoxes} 箱）`
  if (item.limitBy === 'volume') return `体积（体积可装 ${item.volumeBoxes} 箱）`
  if (item.limitBy === 'weight') return `重量（重量可装 ${item.weightBoxes} 箱）`
  return '—'
}

// 箱规数字去掉无意义尾零（50.00 → 50）
function dim(v) {
  const n = Number(v)
  return String(Number((Number.isFinite(n) ? n : 0).toFixed(4)))
}

// 单价展示位数：优先取该行分摊时选定的位数（自适应用），旧记录无此字段则回退 2 位
function unitDecimalsOf(item) {
  const rows = itemsOf(item)
  const d = rows.length ? rows[0].decimals : undefined
  return Number.isFinite(d) ? d : 2
}

// 记录标题：装柜记录显示「柜型 · N 箱」；报价记录多行显示「第一款名 等 N 项」，单行直接显示产品名
function titleOf(item) {
  if (isLoading(item)) {
    return item.title || `${item.containerType || '装柜'} · ${fmt(item.boxes, 0)} 箱`
  }
  const items = itemsOf(item)
  if (items.length > 1) {
    return `${items[0].productName || '未命名产品'} 等 ${items.length} 项`
  }
  return (item && item.productName) || '未命名产品'
}

// 输入摘要：多产品按明细数组描述，单产品沿用旧的 price/qty
function inputText(item) {
  const input = (item && item.input) || {}
  const items = Array.isArray(input.items) && input.items.length ? input.items : null
  const qty = items ? items.reduce((s, it) => s + Number(it.qty || 0), 0) : input.qty
  const head = items ? `${items.length} 个产品 · 合计 ${qty} 件` : `${input.price} 元/件 · ${input.qty} 件`
  return `${head} · 汇率 ${input.exchangeRate} · 利润率 ${input.profitRate}%`
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
    content: '确定删除这条记录吗？',
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
  const total = allList.value.length
  const shown = filteredList.value.length
  const content = filterActive.value
    ? `将删除全部 ${total} 条记录（当前筛选出 ${shown} 条），删除后不可恢复`
    : `将删除全部 ${total} 条记录，删除后不可恢复`
  uni.showModal({
    title: '清空全部',
    content,
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
.empty-actions {
  display: flex;
  justify-content: center;
  margin-top: 24rpx;
}
.empty-actions .btn {
  padding: 16rpx 44rpx;
  font-size: 28rpx;
}
.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.status-text {
  color: #4b5563;
  font-size: 26rpx;
}
.link {
  color: #2563eb;
  font-size: 26rpx;
  padding-left: 16rpx;
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
/* 多产品明细行 */
.items {
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx dashed #e5e7eb;
}
.item-line {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  padding: 6rpx 0;
  font-size: 24rpx;
  color: #4b5563;
}
.item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.item-calc {
  flex-shrink: 0;
  color: #111827;
}

/* ---- 贴边悬浮球 ---- */
.ball-area {
  position: fixed;
  right: -20rpx;
  width: 96rpx;
  z-index: 20;
}
.ball {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #2563eb;
  opacity: 0.7;
  box-shadow: 0 4rpx 12rpx rgba(37, 99, 235, 0.35);
}
.ball-inner {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ball-text {
  color: #ffffff;
  font-size: 22rpx;
  line-height: 26rpx;
}
.ball-dot {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #f97316;
}

/* ---- 底部筛选面板 ---- */
.filter-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 9999;
}
.filter-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  box-sizing: border-box;
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 28rpx;
  padding-bottom: calc(28rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(28rpx + env(safe-area-inset-bottom));
  z-index: 10000;
}
.sheet-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sheet-title {
  font-size: 32rpx;
  font-weight: 600;
}
.sheet-close {
  color: #9ca3af;
  font-size: 36rpx;
  line-height: 1;
  padding: 0 8rpx;
}
.sheet-preview {
  margin: 14rpx 0 20rpx;
  color: #2563eb;
  font-size: 26rpx;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.chip {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 26rpx;
}
.chip.active {
  background: #e0e9ff;
  color: #2563eb;
  font-weight: 600;
}
.range {
  display: flex;
  gap: 20rpx;
  margin-bottom: 28rpx;
}
.range picker {
  flex: 1;
  min-width: 0;
}
.range-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f7f8fa;
  border-radius: 12rpx;
  padding: 18rpx 20rpx;
}
.range-label {
  color: #6b7280;
  font-size: 26rpx;
}
.range-value {
  color: #111827;
  font-size: 26rpx;
  margin-left: 12rpx;
}
.range-value.ph {
  color: #9ca3af;
}
</style>
