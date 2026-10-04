<!-- 装柜计算页：按箱规与柜型估算可装箱数、总方数、总毛重与容积利用率 -->
<template>
  <view class="page">
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
    </view>
  </view>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { calcLoading, formatNumber, CONTAINERS } from '../../utils/calc.js'

const containerKeys = Object.keys(CONTAINERS)

const form = reactive({
  length: 50,
  width: 40,
  height: 30,
  grossWeight: 12,
  containerType: '20GP',
  loadRate: 85,
})

const containerLabels = containerKeys.map((k) => CONTAINERS[k].label)
const containerIndex = computed(() => Math.max(0, containerKeys.indexOf(form.containerType)))

const result = computed(() => calcLoading(form))

const limitText = computed(() => {
  if (result.value.limitBy === 'volume') return '受体积限制（箱数已达容积上限）'
  if (result.value.limitBy === 'weight') return '受重量限制（箱数已达限重上限）'
  return '请填写箱规与重量'
})

function fmt(v, decimals = 2) {
  return formatNumber(v, decimals)
}

function onContainerChange(e) {
  form.containerType = containerKeys[e.detail.value]
}
</script>

<style scoped>
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
</style>
