# 本次任务：把「每次都要手填」的字段变成自动记忆 + 常用税率一键选

## 背景

用户反馈：不要让客户自己填。汇率已经改成实时自动获取了，但**海运费、保险费率、退税率、国内费用、箱规**这些每次打开都得重填一遍。
这些值没有公开实时 API（货代报价/保险公司/税局都不开放），但同一批货、同一段时间内它们是稳定的 —— 所以做成**本地记忆**最实用。

## 要求

### 1. 表单记忆（`src/utils/storage.js` 增加通用记忆函数）

```js
saveForm(key, obj)   // uni.setStorageSync('form:' + key, obj)
loadForm(key)        // 读不到返回 null
```

### 2. 报价页 `src/pages/quote/index.vue`

- 进入页面：先用 `loadForm('quote')` 覆盖默认值（**但汇率字段不参与记忆**，汇率永远由实时接口决定或用户本次手动输入）
- 用户改动任意输入（或点「保存到记录」时）→ `saveForm('quote', {...form})`
  - 建议：用 `watch(form, ...)` 做持久化（`deep: true`），汇率字段写入前剔除或允许写入但进入页面时忽略
- 记忆字段：采购成本、数量、增值税率、出口退税率、国内费用、预期利润率、海运费、保险费率、投保加成率（**不含**产品名/客户名/汇率）

### 3. 常用税率一键选（减少手输）

- 「增值税率」下面加一排小按钮：`13%` `9%` `6%`，点击直接填入（当前值高亮）
- 「出口退税率」下面加一排小按钮：`13%` `10%` `9%` `6%` `0%`，点击填入
- 样式复用现有的 chip/小按钮风格（自己写 `.chip` 样式，别引 UI 库）

### 4. 装柜页 `src/pages/loading/index.vue`

- 同样用 `loadForm('loading')` / `saveForm('loading')` 记忆：长、宽、高、单箱毛重、柜型、装载率

### 5. AI 邮件页 `src/pages/ai/index.vue`

- 只记忆「客户名」和「产品」两个字段（`loadForm('ai')` / `saveForm('ai')`），关键信息不记忆

## 约束

- 不引 UI 库；不改 `calc.js`；不动 `dist`
- **不要**启动任何服务（5174 / 8787 / 5173 都占着），**不要**跑 `npm run dev:mp-weixin`（监听在跑）
- 自测：`npm run build:mp-weixin` 必须 Build complete
- 提交：`git -c user.email=dev@local -c user.name=dev commit -m "feat: 表单本地记忆 + 常用税率一键选"`

## 汇报（中文）

改了哪些文件、记忆了哪些字段、chips 效果、build 结果、遗留问题。
