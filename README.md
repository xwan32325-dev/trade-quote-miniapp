# 外贸算价助手（trade-miniapp）

面向外贸业务员的小程序：**报价计算 + 装柜计算 + AI 邮件 + 历史记录**。

技术栈：uni-app（Vue3 + `<script setup>`）+ Vite，编译目标微信小程序（mp-weixin），同时支持 H5 调试。

## 功能

- **报价计算**：按成本、退税率、汇率、利润率等算出 FOB / CFR / CIF 单价与总价，以及退税额、出口总成本、保险费、换汇成本、盈亏率；换汇成本低于汇率标绿「盈利」，高于汇率标红「亏损」。
- **装柜计算**：按箱规、毛重、柜型（20GP / 40GP / 40HQ）与装载率，算出可装箱数、总方数、总毛重、容积利用率，并明确指出受体积还是重量限制。
- **AI 邮件**：报价邮件 / 开发信 / 催款邮件 / 跟进邮件四套模板，调用后端 `/api/run-once` 生成，结果可复制。
- **我的记录**：报价记录本地保存（最多 50 条，新记录在前），可展开详情、删除单条、清空全部。

## 目录结构

```
src/pages.json                 # 4 个 tab 的 tabBar 配置（纯文字）
src/pages/quote/index.vue      # 报价计算（启动页）
src/pages/loading/index.vue    # 装柜计算
src/pages/ai/index.vue         # AI 邮件
src/pages/history/index.vue    # 我的记录
src/utils/calc.js              # 纯函数：报价计算 + 装柜计算（便于单测）
src/utils/storage.js           # 本地存储封装（uni.setStorageSync）
src/utils/request.js           # 后端请求封装（uni.request，地址可配置）
scripts/verify-calc.mjs        # 计算逻辑自测脚本（Node 直接运行）
```

## 运行

```bash
npm run dev:h5            # H5 调试，端口 5174
npm run dev:mp-weixin     # 微信小程序开发编译
npm run build:mp-weixin   # 微信小程序生产构建（产物在 dist/build/mp-weixin）
node scripts/verify-calc.mjs   # 计算逻辑自测
```

## AI 邮件后端

默认后端地址 `http://localhost:8787`，可在「AI 邮件」页的「设置」中修改（存于本地 `apiBase`）。

接口约定：

```
POST {BASE}/api/run-once
body: { "tool": "rewrite", "system": "<模板提示词>", "input": "<用户输入>", "model": "deepseek-flash" }
resp: { "text": "...", "elapsedMs": 1234, "tokens": 210 }
```

## 计算口径

所有计算逻辑集中在 `src/utils/calc.js` 的纯函数中，页面只负责取输入、调用函数、渲染。

| 柜型 | 内容积(CBM) | 实际可用(CBM) | 限重(kg) |
| --- | --- | --- | --- |
| 20GP | 33.2 | 28 | 17500 |
| 40GP | 67.7 | 58 | 22000 |
| 40HQ | 76.4 | 68 | 22000 |

> 柜型参数为常见行业参考值，不同船公司略有差异，仅用于估算。
