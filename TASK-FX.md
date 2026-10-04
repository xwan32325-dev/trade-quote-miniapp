# 本次任务：报价页接入实时汇率（自动填入 + 手动可覆盖）

## 背景

现在汇率要用户手填（默认 7.1），不专业也容易填错。后端已经做好实时汇率接口（已实测通过）：

```
GET {apiBase}/api/fx?from=USD&to=CNY[&force=1]
→ {
    ok: true, base: "USD", quote: "CNY",
    rate: 6.7046,            // 实时汇率
    previousRate: 6.7045,    // 上一交易日
    change: 0.0001,          // 涨跌绝对值（可能为 null）
    changePct: 0.001,        // 涨跌百分比（可能为 null）
    source: "frankfurter.app (ECB)",
    sourceDate: "2026-10-02",// 数据日期
    fetchedAt: "2026-10-04T14:18:26.627Z",
    stale: false,            // true = 所有源都失败，这是磁盘上的旧值
    cached: false            // true = 命中 30 分钟缓存
  }
失败时 → HTTP 502 + { ok:false, message:"...", errors:[...] }
```

## 要求

### 1. `src/utils/request.js` 增加函数

```js
getFxRate({ from = 'USD', to = 'CNY', force = false })
```
用现成的 `uni.request` 封装，返回上面的对象；失败时抛出带后端 `message` 的错误。

### 2. `src/pages/quote/index.vue`

**进入页面自动获取**：`onMounted` 时调用 `getFxRate()`，成功且用户没手动改过 → 把 `form.exchangeRate` 设为 `rate`（保留 4 位小数）。

**汇率那一行下面加一条状态栏**（小字，紧贴汇率输入框）：

| 情况 | 显示 |
| --- | --- |
| 加载中 | `⏳ 正在获取实时汇率…` |
| 成功 | `🟢 实时 6.7046 ↑0.001% · 数据日 10-02 · frankfurter.app (ECB)` + 右侧「刷新」 |
| 成功但 stale | `🟠 实时源不可用，沿用 6.7046（请自行确认）` |
| 失败 | `🔴 获取失败：<后端 message>（沿用 6.7046，请手动确认）` + 右侧「重试」 |
| 用户手动改过 | `⚪ 手动输入（未使用实时汇率)` + 右侧「用实时汇率」 |

- 涨跌颜色：`change > 0` 用红色（人民币贬值），`change < 0` 用绿色；`changePct` 为 null 时不显示涨跌
- 用户在汇率输入框输入时（`@input`）把状态切成「手动」，之后自动刷新**不得**覆盖他填的值
- 点「用实时汇率」→ 重新拉一次并覆盖
- 「刷新」→ `getFxRate({ force: true })`（绕过 30 分钟缓存）
- 汇率输入框**保持可编辑**（自动填好是默认行为，但要允许改）

### 3. 「复制报价文本」里带上汇率来源

把最后一行改成：

```
数量：1,000 件 | 汇率：6.7046（实时 10-02） | 盈亏率：10.00%
```

（手动模式下写成 `汇率：7.2000（手动）`）

### 4. 其他

- 不要改 `calc.js` 的计算逻辑
- 不要动其他页面、不要动 `dist`
- **不要**启动任何服务（5174 / 8787 / 5173 我都占着），**不要**跑 `npm run dev:mp-weixin`（监听在跑）
- 自测：`npm run build:mp-weixin` 必须 Build complete
- 提交：`git -c user.email=dev@local -c user.name=dev commit -m "feat(quote): 汇率改为实时自动获取，支持手动覆盖"`

## 汇报（中文）

改了哪些文件与关键行、四种状态文案、build 是否通过、遗留问题。
