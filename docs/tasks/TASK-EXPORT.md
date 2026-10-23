# 本次任务：报价单导出（图片 / PDF，可直接发客户）

## 背景

业务员算完价，要能把报价单直接发客户。后端**已经做好并实测通过**：

```
GET  {apiBase}/api/quote-doc?data=<encodeURIComponent(JSON.stringify(payload))>&format=png   → image/png（实测 1800×2400）
GET  {apiBase}/api/quote-doc?data=...&format=pdf                                             → application/pdf（实测 109KB，1.5 秒）
POST {apiBase}/api/quote-doc   body: { quote, company, format }                              → 同上（H5 也可用）

payload = {
  quote: { productName, customerName, qty, unitPrice, totalPrice, currency,
           tradeTerm, transportMode, multimodalText, exchangeRate, remark },
  company: { name, address, contact, phone, email },
  format: "png" | "pdf"
}
```

## 一、报价页 `src/pages/quote/index.vue`

1. 结果卡片底部（「保存到记录」「复制报价文本」同一行或下一行）加按钮：**`📄 导出报价单`**
2. 点击弹出**导出面板**（页面内弹层，自己写样式，别引 UI 库）：
   - 标题「导出报价单」+ 关闭按钮
   - **公司信息**（可编辑，本地记忆，key 用 `form:company`）：公司名称、地址、联系人、电话、邮箱
     - 首次打开给空值 + placeholder（如「如：上海某某进出口有限公司」），让用户自己填一次以后都记住
   - **备注**输入框（单行，参与记忆，传给 `quote.remark`）
   - 两个主按钮：
     - `📷 生成图片报价单`（推荐，小字说明：可直接在微信里发给客户）
     - `📄 导出 PDF 报价单`（小字说明：适合正式邮件/打印）
   - 生成中按钮文案变「生成中…」并禁用，防重复点
3. 数据组装（取当前表单 + 当前所选术语的计算结果）：
   ```
   unitPrice / totalPrice 用当前所选贸易方式对应的值（与结果区显示一致）
   transportMode 用运输方式的名称（多式联运时另传 multimodalText = multiText）
   tradeTerm 传代码（如 CIF）
   ```
4. 导出前的校验（复用现有规则）：
   - 多式联运不足 2 种 → 提示「多式联运至少选 2 种」并阻止导出
   - 手动定价**低于成本**时 → 先 `uni.showModal` 确认「当前报价低于成本，仍要导出吗？」
5. **平台差异（条件编译）**：
   - **H5**：直接把上面那个 GET URL 用 `window.open(url, '_blank')` 打开（浏览器里可预览/下载/打印）
   - **小程序（MP-WEIXIN）**：`uni.downloadFile({ url })` →
     - `format=png`：`uni.saveImageToPhotosAlbum({ filePath })` 成功后提示「已保存到相册，可直接发给客户」；失败（用户拒绝授权）要给出明确提示与引导
     - `format=pdf`：`uni.openDocument({ filePath, fileType: 'pdf', showMenu: true })`（右上角菜单可转发）
   - 失败统一把后端返回的 `message` 显示出来，不要吞

## 二、约束

- 不引 UI 库；不改 `calc.js` / `incoterms.js` 的计算逻辑
- **不要启动任何服务**（8787 / 8790 在跑），**不要**跑 `dev:mp-weixin`
- **不要删除 `dist` 目录**（开发者工具正开着项目，删了会导致 "app.json 未找到" 报错）
- 自测：`npm run build:mp-weixin` 与 `npm run build:h5` 都要 Build complete
- 提交：`git -c user.email=dev@local -c user.name=dev commit -m "feat(quote): 报价单导出（图片/PDF，可直接发客户）"`

## 三、汇报（中文）

改了哪些文件、导出面板结构、两端下载/保存的实现差异、校验逻辑、两个 build 结果、遗留问题。
