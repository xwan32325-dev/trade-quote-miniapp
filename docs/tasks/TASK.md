# 本次任务（给 Claude Code）

按同目录 `SPEC.md` 完整实现「外贸算价助手」小程序，并自测。

## 关键约束

- 项目是 uni-app（Vue3 + Vite），目录已就绪，`node_modules` 已装好（940 个包），**不要重新 npm install**
- 只改 `src/`、`vite.config.js`、`package.json`(name)、`README.md` 这些文件
- 计算逻辑必须严格按 SPEC.md 的公式，不得自行"优化"或改口径

## 必须自测（这是硬性验收，数值必须对得上）

写一个临时脚本 `scripts/verify-calc.mjs`，用下面的方式在 Node 里跑 `src/utils/calc.js` 的纯函数
（`src/utils/calc.js` 是 ESM，但 package.json 没有 type:module，所以用 data: URL 动态导入）：

```js
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/utils/calc.js', import.meta.url), 'utf8').replace(/export\s+/g, '');
const mod = await import('data:text/javascript,' + encodeURIComponent(src));
```

**用例 1（报价）**：
采购含税 100 元/件、数量 1000、增值税 13%、退税率 13%、国内费用 2000 元、
汇率 7.1、利润率 10%、海运费 500 美元、保险费率 0.3%、投保加成 10%

期望值（允许 ±0.02 的浮点误差）：
- 退税额合计 ≈ 11504.42
- 出口总成本 ≈ 90495.58
- FOB 总价 ≈ 14020.44，FOB 单价 ≈ 14.02
- CFR 总价 ≈ 14520.44
- CIF 总价 ≈ 14568.53，保险费 ≈ 48.08
- 换汇成本 ≈ 6.4546（低于汇率 7.1 → 判定为「盈利」）
- 盈亏率 ≈ 10.00%

**用例 2（装柜）**：50×40×30 cm、单箱毛重 12kg、20GP、装载率 85%
- 单箱体积 = 0.06 CBM
- 体积可装 = 396 箱（28 × 0.85 ÷ 0.06 = 396.6 → floor）
- 重量可装 = 1458 箱（17500 ÷ 12）
- 最终可装 = 396 箱，且**提示受体积限制**
- 总方数 ≈ 23.76 CBM，总毛重 = 4752 kg

**用例 3（边界）**：数量 0、汇率 0、单箱尺寸 0 → 结果必须是 0 或 null，**绝不能出现 NaN / Infinity**

脚本跑完打印 PASS/FAIL，有 FAIL 就修到 PASS 为止。

## 其他自测

1. `npm run build:mp-weixin` 必须 `Build complete`，并确认 `dist/build/mp-weixin/app.json` 里 `tabBar` 有 4 个页面
2. `npm run dev:h5` 能启动在 **5174** 端口（起得来即可，测完停掉）
3. 用 `git init` 建仓库并提交（`git -c user.email=dev@local -c user.name=dev commit`），
   首次提交信息 `feat: 外贸算价助手（报价/装柜/AI邮件/记录）`
4. 汇报里贴出 verify-calc.mjs 的真实输出

## 汇报格式（中文）

- 文件清单（每个文件一句话）
- verify-calc.mjs 的真实输出（PASS/FAIL 与每个数值）
- build:mp-weixin 的真实输出
- 遗留问题 / 不确定的地方
