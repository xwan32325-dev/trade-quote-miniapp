# 本次任务：报价支持多币种（不只美元）

## 背景

外贸结算币种很多（欧元、日元、英镑、东南亚本地币……）。现在报价页写死 USD，
后端汇率接口已经支持任意币种（已实测 25 种全部可用），需要把前端做成多币种。

实测可用币种（后端 `/api/fx?from=币种&to=CNY` 全部返回正常）：

```
USD EUR JPY GBP AUD HKD CAD SGD KRW THB VND MYR IDR PHP INR RUB AED MXN BRL ZAR TRY CHF NZD PLN SEK
```

## 一、新增 `src/utils/currency.js`

```js
export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: '美元' },
  { code: 'EUR', symbol: '€', name: '欧元' },
  { code: 'JPY', symbol: '¥', name: '日元' },
  { code: 'GBP', symbol: '£', name: '英镑' },
  { code: 'AUD', symbol: 'A$', name: '澳元' },
  { code: 'HKD', symbol: 'HK$', name: '港币' },
  { code: 'CAD', symbol: 'C$', name: '加元' },
  { code: 'SGD', symbol: 'S$', name: '新加坡元' },
  { code: 'KRW', symbol: '₩', name: '韩元' },
  { code: 'THB', symbol: '฿', name: '泰铢' },
  { code: 'VND', symbol: '₫', name: '越南盾' },
  { code: 'MYR', symbol: 'RM', name: '马来西亚林吉特' },
  { code: 'IDR', symbol: 'Rp', name: '印尼盾' },
  { code: 'PHP', symbol: '₱', name: '菲律宾比索' },
  { code: 'INR', symbol: '₹', name: '印度卢比' },
  { code: 'RUB', symbol: '₽', name: '卢布' },
  { code: 'AED', symbol: 'AED', name: '迪拉姆' },
  { code: 'MXN', symbol: 'MX$', name: '墨西哥比索' },
  { code: 'BRL', symbol: 'R$', name: '雷亚尔' },
  { code: 'ZAR', symbol: 'R', name: '南非兰特' },
  { code: 'TRY', symbol: '₺', name: '土耳其里拉' },
  { code: 'CHF', symbol: 'CHF', name: '瑞士法郎' },
  { code: 'NZD', symbol: 'NZ$', name: '新西兰元' },
  { code: 'PLN', symbol: 'zł', name: '波兰兹罗提' },
  { code: 'SEK', symbol: 'kr', name: '瑞典克朗' },
]

export function getCurrency(code) { /* 返回对应项，找不到回退 USD */ }

/** 汇率显示位数：小面值币种必须多给几位，否则会显示成 0.0000 */
export function rateDecimals(rate) {
  const n = Number(rate)
  if (!Number.isFinite(n) || n <= 0) return 4
  if (n >= 1) return 4
  if (n >= 0.01) return 5
  if (n >= 0.001) return 6
  if (n >= 0.0001) return 7
  return 8
}
```

**重要**：后端返回的汇率是**全精度**（例如越南盾 `0.000258`、印尼盾 `0.00037`）。
前端**绝对不能**再 `toFixed(4)` 存值 —— 那会把 0.000258 截成 0.0003（约 16% 误差，报价直接算错）。
存 `form.exchangeRate` 时用原始数值，只在**显示**时按 `rateDecimals()` 取位数。

## 二、报价页 `src/pages/quote/index.vue`

1. 「汇率与利润」卡片最上面加**币种选择**（`picker mode="selector"`）：
   显示 `美元（USD） ›` 这样的当前值，选项列表用 `名称（代码）`
2. 切换币种后：
   - 立即按新币种重新拉汇率（`getFxRate({ from: 币种, to: 'CNY', force: true })`）
   - 退出手动模式，重置为自动
3. 文案动态化：
   - 汇率标签：`汇率（1 EUR = ? ¥）`
   - 状态栏：`🟢 实时 1 EUR = 7.5259 ¥ · ↑0.001% · 数据日 10-02 · frankfurter.app (ECB)`
   - 所有金额用该币种符号（`$` / `€` / `¥` / `A$` / `₫` …），例如 `€ 13.20 / 件`
   - 海运费输入框的单位跟着变（`$` → `€`）
4. 装柜页、AI 邮件页不变

## 三、复制报价文本（外贸单据习惯用代码，避免 ¥/$ 歧义）

```
【报价单】未命名产品 - 未填写客户
币种：EUR
FOB 上海：EUR 13.20/件（总价 EUR 13,200.00）
CFR：EUR 13.65/件（总价 EUR 13,650.00）
CIF：EUR 13.70/件（总价 EUR 13,700.00）
数量：1,000 件 | 汇率：1 EUR = 7.5259 ¥ | 盈亏率：10.00%
有效期：30 天
```

## 四、我的记录

- 记录里存 `currency` 字段（代码即可）
- 列表和详情显示币种，例如 `EUR 单价 13.20`
- 旧的没有 currency 字段的记录，按 USD 兜底显示

## 五、约束

- 不引 UI 库；不改 `calc.js` 的计算公式（只把「美元金额」的语义泛化为「所选币种金额」）
- `form.currency` 要参与**表单记忆**（下次打开还是上次选的币种），汇率仍不参与记忆
- **不要**启动任何服务（8787/8790/5173 都在跑），**不要**跑 `npm run dev:mp-weixin`
- 自测：`npm run build:mp-weixin` 与 `npm run build:h5` 都要 Build complete
- 提交：`git -c user.email=dev@local -c user.name=dev commit -m "feat(quote): 报价支持 25 种结算币种"`

## 六、汇报（中文）

改了哪些文件、币种切换逻辑、小面值币种（VND/IDR/KRW）的显示位数处理、两个 build 结果、遗留问题。
