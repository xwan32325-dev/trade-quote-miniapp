<!-- AI 邮件页：按模板拼装提示词，调用后端一次性接口生成外贸邮件 -->
<template>
  <view class="page">
    <view class="card">
      <view class="card-title">邮件模板</view>
      <picker mode="selector" :range="templateNames" :value="templateIndex" @change="onTemplateChange">
        <view class="field">
          <text class="field-label">选择模板</text>
          <text class="field-value">{{ currentTemplate.name }} ›</text>
        </view>
      </picker>
      <view class="field">
        <text class="field-label">客户名</text>
        <input class="field-input" v-model="form.customer" placeholder="如 John / ABC Trading" />
      </view>
      <view class="field">
        <text class="field-label">产品</text>
        <input class="field-input" v-model="form.product" placeholder="如 LED 灯带" />
      </view>
      <view class="field field-col">
        <text class="field-label">要传达的关键信息</text>
        <textarea class="field-textarea" v-model="form.keyInfo" placeholder="如：报价 $14.02/件 FOB 宁波，30 天交期，付款方式 T/T" />
      </view>
    </view>

    <view class="card">
      <view class="row">
        <view class="btn" :class="{ disabled: loading }" @click="onGenerate">{{ loading ? '生成中…' : '生成' }}</view>
        <view class="btn btn-ghost" @click="showSettings = !showSettings">设置</view>
      </view>
    </view>

    <view class="card" v-if="showSettings">
      <view class="card-title">后端地址</view>
      <view class="field">
        <input class="field-input field-input-wide" v-model="apiBaseDraft" placeholder="http://localhost:8787" />
      </view>
      <view class="row" style="margin-top: 16rpx">
        <view class="btn btn-ghost" @click="onSaveBase">保存地址</view>
      </view>
      <view class="muted" style="margin-top: 10rpx">当前：{{ apiBase }}</view>
    </view>

    <view class="card" v-if="error">
      <view class="card-title loss">生成失败</view>
      <view class="loss">{{ error }}</view>
    </view>

    <view class="card" v-if="output">
      <view class="card-title">生成结果</view>
      <view class="output">{{ output }}</view>
      <view class="muted" v-if="meta">耗时 {{ meta.elapsedMs || '-' }} ms · tokens {{ meta.tokens || '-' }}</view>
      <view class="row" style="margin-top: 20rpx">
        <view class="btn btn-ghost" @click="onCopy">复制结果</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { runOnce, getApiBase, setApiBase } from '../../utils/request.js'

// 每个模板对应一段 system 提示词
const TEMPLATES = [
  {
    key: 'quote',
    name: '报价邮件',
    system:
      '你是资深外贸业务员。请根据给定的客户名、产品与关键信息，写一封简洁专业的英文报价邮件。要求：主题行以 Subject: 开头，正文包含问候、产品与报价要点、有效期与下一步行动，语气礼貌、无拼写错误。只输出邮件内容，不要额外解释。',
  },
  {
    key: 'cold',
    name: '开发信',
    system:
      '你是资深外贸业务员。请写一封面向潜在海外客户的英文开发信（cold email）。要求：主题行以 Subject: 开头，开场简短自我介绍与来意，突出产品价值与差异化优势，结尾给出明确的行动呼吁。语气专业、不夸张，只输出邮件内容。',
  },
  {
    key: 'payment',
    name: '催款邮件',
    system:
      '你是资深外贸业务员。请写一封英文催款邮件。要求：主题行以 Subject: 开头，礼貌提醒逾期款项、列明金额与到期日、询问付款计划，保持合作友好的语气但立场清晰。只输出邮件内容。',
  },
  {
    key: 'followup',
    name: '跟进邮件',
    system:
      '你是资深外贸业务员。请写一封英文跟进邮件（follow-up）。要求：主题行以 Subject: 开头，提及上次沟通背景，重申关键卖点或进度，礼貌询问客户意见并推动下一步。简洁、专业，只输出邮件内容。',
  },
]

const templateNames = TEMPLATES.map((t) => t.name)
const templateIndex = ref(0)
const currentTemplate = computed(() => TEMPLATES[templateIndex.value])

const form = reactive({ customer: '', product: '', keyInfo: '' })

const loading = ref(false)
const output = ref('')
const error = ref('')
const meta = ref(null)

const showSettings = ref(false)
const apiBase = ref(getApiBase())
const apiBaseDraft = ref(getApiBase())

function onTemplateChange(e) {
  templateIndex.value = Number(e.detail.value) || 0
}

function onSaveBase() {
  apiBase.value = setApiBase(apiBaseDraft.value)
  apiBaseDraft.value = apiBase.value
  uni.showToast({ title: '已保存', icon: 'success' })
}

async function onGenerate() {
  if (loading.value) return
  error.value = ''
  output.value = ''
  meta.value = null
  loading.value = true
  const userInput = [
    `客户名：${form.customer || '（未填）'}`,
    `产品：${form.product || '（未填）'}`,
    `关键信息：${form.keyInfo || '（未填）'}`,
  ].join('\n')
  try {
    const res = await runOnce({ system: currentTemplate.value.system, input: userInput })
    output.value = res.text || '（后端未返回文本）'
    meta.value = { elapsedMs: res.elapsedMs, tokens: res.tokens }
  } catch (e) {
    // 失败必须把后端返回的错误展示出来，不吞掉
    error.value = e && e.message ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function onCopy() {
  uni.setClipboardData({
    data: output.value,
    success: () => uni.showToast({ title: '已复制', icon: 'success' }),
  })
}
</script>

<style scoped>
.field-value {
  color: #111827;
  font-weight: 600;
}
.field-col {
  flex-direction: column;
  align-items: flex-start;
}
.field-textarea {
  width: 100%;
  min-height: 160rpx;
  margin-top: 12rpx;
  font-size: 28rpx;
  color: #111827;
}
.field-input-wide {
  width: 100%;
  text-align: left;
}
.output {
  white-space: pre-wrap;
  line-height: 1.6;
  color: #111827;
}
.disabled {
  opacity: 0.6;
}
</style>
