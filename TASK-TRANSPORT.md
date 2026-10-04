# 本次任务：运输方式改成选择式（11 种 + 多式联运多选），并修正贸易术语

## 一、背景

外贸报价要先定运输方式，通常是**单选**；如果走多式联运，需要再让用户勾选**用了哪几种**组合。
另外：**FOB/CFR/CIF 是海运专用术语**，空运/铁路/公路/快递/多式联运按 Incoterms 应该用
**FCA/CPT/CIP**。公式口径完全一样（FCA≈FOB、CPT=运费加进去、CIP=再加保险），只是**名称要跟着运输方式变**，
不然外贸业务员一眼就看出不专业。

## 二、新增 `src/utils/transport.js`

```js
export const TRANSPORT_MODES = [
  { code: 'SEA_FCL',   name: '海运整柜（FCL）' },
  { code: 'SEA_LCL',   name: '海运拼箱（LCL）' },
  { code: 'SEA_BULK',  name: '海运散杂货' },
  { code: 'AIR',       name: '空运' },
  { code: 'EXPRESS',   name: '国际快递' },
  { code: 'POST',      name: '国际邮政小包' },
  { code: 'RAIL',      name: '铁路运输（中欧班列）' },
  { code: 'ROAD',      name: '公路运输（跨境卡航）' },
  { code: 'INLAND',    name: '内河运输' },
  { code: 'PIPELINE',  name: '管道运输' },
  { code: 'LAND_BRIDGE', name: '大陆桥运输' },
]

// 多式联运单独一个选项（第 12 项），选中后展开多选，从上面 11 种里勾选实际组合
export const MULTIMODAL = { code: 'MULTIMODAL', name: '多式联运' }

export function getMode(code) { /* 找不到回退第一个 */ }

/** 是否属于海运类：决定用 FOB/CFR/CIF 还是 FCA/CPT/CIP */
export function isSeaMode(code) { /* SEA_FCL / SEA_LCL / SEA_BULK / INLAND 视为海运类 */ }

/** 贸易术语名称：海运类 → FOB/CFR/CIF；其他 → FCA/CPT/CIP */
export function termNames(code) { /* 返回 { base:'FOB', freight:'CFR', insured:'CIF' } 或 FCA/CPT/CIP */ }

/** 运费输入框的标签，随运输方式变化 */
export function freightLabel(code) {
  // 海运 → 海运费（整票）；空运 → 空运费；国际快递 → 快递费；邮政 → 邮费；
  // 铁路 → 铁路运费；公路 → 公路运费；内河 → 内河运费；管道 → 管道运费；
  // 大陆桥 → 大陆桥运费；多式联运 → 全程运费（多式联运）
}
```

## 三、报价页 `src/pages/quote/index.vue`

1. 「汇率与利润」下方、运费之前，新增**运输方式卡片**：
   - `picker mode="selector"` 单选，12 个选项（11 种 + 多式联运），默认 `海运整柜（FCL）`
   - 选「多式联运」时，下方展开**多选**区域：11 种方式做成可点的小方块（`.chip` 样式，已选中高亮），
     并显示「已选组合：海运整柜 + 铁路运输」；**少于 2 种时要给出提示**（"多式联运至少选 2 种"）
   - 非多式联运时，多选区域隐藏
2. 术语名称动态化：结果区与复制文本里的 `FOB/CFR/CIF` 改成按 `termNames()` 输出（海运类不变，其他变 `FCA/CPT/CIP`）
3. 运费输入框标签用 `freightLabel()`
4. 非海运类时，在运费卡片下方加一行小字提示：
   `⚠️ 空运/铁路等非海运方式按 Incoterms 用 FCA/CPT/CIP；本页计算口径相同（运费、保险照常计入）`
5. `form.transportMode` 与 `form.multimodal`（数组）参与**表单记忆**

## 四、复制报价文本

```
【报价单】未命名产品 - 未填写客户
币种：EUR
运输方式：海运整柜（FCL）
FOB 上海：EUR 13.20/件（总价 EUR 13,200.00）
CFR：EUR 13.65/件（总价 EUR 13,650.00）
CIF：EUR 13.70/件（总价 EUR 13,700.00）
数量：1,000 件 | 汇率：1 EUR = 7.5259 ¥ | 盈亏率：10.00%
有效期：30 天
```

- 多式联运时：`运输方式：多式联运（海运整柜 + 铁路运输）`
- 非海运类时：术语行换成 `FCA / CPT / CIP`

## 五、我的记录

记录里存 `transportMode`（代码）和 `multimodal`（数组），列表/详情显示运输方式名称（旧记录没有该字段时按「海运整柜」兜底）。

## 六、约束

- 不改 `calc.js` 的公式（只改展示名称与新增字段）
- 不引 UI 库；`` 与 `` 都可能有用户正在看，**不要启动任何服务**（8787 / 8790 / 5173 / 5174），**不要**跑 `dev:mp-weixin`
- 自测：`npm run build:mp-weixin` 与 `npm run build:h5` 都要 Build complete
- 提交：`git -c user.email=dev@local -c user.name=dev commit -m "feat(quote): 运输方式选择式（11种+多式联运多选）并按方式切换 FOB/CFR/CIF 与 FCA/CPT/CIP"`

## 七、汇报（中文）

改了哪些文件、多式联运的交互与校验、术语切换逻辑、两个 build 结果、遗留问题。
