# 本次任务：报价结果只显示「所选贸易术语」的单价/总价

## 背景

现在 `报价结果` 把 FOB/CFR/CIF（或 FCA/CPT/CIP）三个术语各显示单价+总价，共 6 行，实际报价只会用一个。
需要加一个**贸易术语选择器**，结果区只显示所选术语的单价与总价。

## 一、贸易术语选择（`src/utils/transport.js` 增加）

```js
/** 按运输方式返回可选贸易术语：海运类 FOB/CFR/CIF，非海运 FCA/CPT/CIP */
export function termOptions(modeCode) {
  // 海运类（SEA_FCL/SEA_LCL/SEA_BULK/INLAND）：
  //   [{ code:'FOB', name:'FOB（船上交货）' }, { code:'CFR', name:'CFR（成本加运费）' }, { code:'CIF', name:'CIF（成本加保险费、运费）' }]
  // 其他：
  //   [{ code:'FCA', name:'FCA（货交承运人）' }, { code:'CPT', name:'CPT（运费付至）' }, { code:'CIP', name:'CIP（运费加保险费付至）' }]
}

/** 切换运输方式时保持"同一层级"：FOB↔FCA、CFR↔CPT、CIF↔CIP */
export function mapTermLevel(termCode) { /* 返回 'base' | 'freight' | 'insured' */ }
export function termByLevel(modeCode, level) { /* 按层级取该方式下的术语代码 */ }
```

现有 `termNames()` 可保留，但结果区改用所选术语。

## 二、报价页 `src/pages/quote/index.vue`

1. 「运输方式」卡片里，运输方式下方**紧跟一个「贸易术语」picker**：
   - 选项来自 `termOptions(form.transportMode)`，默认第一个（海运默认 FOB，非海运默认 FCA）
   - 切换运输方式时，**按层级自动跟随**：原来选 CFR，切到空运自动变 CPT；原来 CIF → CIP；FOB → FCA（反之亦然）
2. **报价结果区改成只显示所选术语**：
   ```
   报价结果
     贸易术语  CIF ›                     ← 也可以不放 picker，但标题要能看出当前术语
     CIF 单价        € 13.70 / 件
     CIF 总价        € 13,700.00
     ────────────────────────────
     保险费          € 40.20
     退税额合计      ¥ 11,504.42
     出口总成本      ¥ 90,495.58
     换汇成本（1 EUR = 7.5259 ¥）   6.0951 盈利
     盈亏率          10.00%
   ```
   - **删掉另外两个术语的行**（不再显示 FOB/CFR 或 CPT/CIP 的多余行）
   - 单价/总价用大一号字或加粗突出
   - `保险费` 一行只在所选术语是 CIF/CIP 时显示（FOB/CFR 不含保险，显示会误导）；不是 CIF/CIP 时改为在下面加一行灰色小字：`保险费 € 40.20（未计入所选术语报价）`
3. `form.tradeTerm` 参与**表单记忆**（切换运输方式后按层级映射，记忆里存代码）
4. 复制报价文本：**只输出所选术语那一行**，例如：
   ```
   【报价单】未命名产品 - 未填写客户
   币种：EUR
   运输方式：海运整柜（FCL）
   贸易术语：CIF
   CIF：EUR 13.70/件（总价 EUR 13,700.00）
   数量：1,000 件 | 汇率：1 EUR = 7.5259 ¥ | 盈亏率：10.00%
   有效期：30 天
   ```
   多式联运时运输方式行照旧写组合。

## 三、我的记录 `src/pages/history/index.vue`

- 记录里存 `tradeTerm`（代码），列表显示所选术语的单价/总价（不再固定 FOB/CFR/CIF）
- 旧记录没有 `tradeTerm` 的，按原 `term` 字段兜底

## 四、约束

- 不改 `calc.js` 的计算公式（三个价格仍然都算，只是展示只显示所选那个）
- **不要启动任何服务**（8787 / 8790 / 5173 / 5174 都在跑），**不要**跑 `dev:mp-weixin`
- 自测：`npm run build:mp-weixin` 与 `npm run build:h5` 都要 Build complete
- 提交：`git -c user.email=dev@local -c user.name=dev commit -m "feat(quote): 报价结果只显示所选贸易术语的单价/总价"`

## 五、汇报（中文）

改了哪些文件、术语跟随运输方式的映射规则、结果区新结构、两个 build 结果、遗留问题。
