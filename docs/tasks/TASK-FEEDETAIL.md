# 本次任务：国内费用拆成明细项，合计自动累加

## 背景

现在「国内费用合计」是一个打包的大项（默认 2000），业务员容易漏项、也没法对账。
改成**明细逐项填写 + 合计自动累加**。

## 一、明细项（成本与费率卡片，「出口退税率」之后）

| 变量 | 标签 | 默认值（¥，整票） |
| --- | --- | --- |
| `feeCustoms` | 报关费 | 500 |
| `feeTrucking` | 拖车费（工厂→港口） | 800 |
| `feePort` | 港杂费（THC/港口操作） | 500 |
| `feeDocs` | 单证费（产地证/商检/认证） | 200 |
| `feeBank` | 银行费用（结汇/信用证） | 0 |
| `feeWarehouse` | 仓储费（仓库/装柜） | 0 |
| `feeOther` | 其他费用 | 0 |

- 每项都是 `type="digit"`，单位 `¥`，整票
- 默认合计 = 2000（与改动前的默认总成本一致，避免默认报价变化）
- **可选项目默认 0**（银行/仓储/其他）—— 没有这项支出就不该凭空多出成本

下面加一行**只读合计**：

```
国内费用合计            ¥ 2,000.00
```

- 输入框样式但与普通输入区分（灰底/不可编辑），数字随上面各项实时累加
- 删除原「国内费用合计（报关/拖车/单证/银行，不含仓储费）」输入框
- 另加一行灰色小字：`按实际发生额填写；没有的项目填 0`

## 二、计算口径调整（保持公式不变，只改输入来源）

`calcTermQuote` 继续接收一个 `domesticFee` 数字，**由页面把 7 项累加后传入**：

```
domesticFee = feeCustoms + feeTrucking + feePort + feeDocs + feeBank + feeWarehouse + feeOther
withDomestic¥ = 货值成本¥ + domesticFee          // 原先还单独加 warehouseFee，现在仓储已含在合计里，去掉那一项
EXW 成本¥     = 货值成本¥                        // 仍不含国内费用
```

- 此前独立的 `warehouseFee` 概念**取消**（仓储费现在只是明细中的一项）
- 手动定价里 EXW 的附加费用倒推改为 `-(domesticFee) / exchangeRate`
- 所有汇率/保险/关税/增值税公式不动

## 三、结果区

- 非 EXW 术语：在「出口成本（含国内费用）」下面加一行 `国内费用合计  ¥ x,xxx.00`（取代原来的「仓储费」行）
- EXW 术语：不显示该行，且「未计入本术语」提示里包含 `国内费用合计`
- 复制报价文本不变（国内费用属内部成本，不单列）

## 四、兼容旧数据（表单记忆）

`localStorage` 里可能还存着旧结构（`domesticFee`、`warehouseFee`）。读取记忆时：

```
若存在旧 domesticFee 且新的 7 项都不存在 → feeOther = 旧 domesticFee
若存在旧 warehouseFee                    → feeWarehouse = 旧 warehouseFee（并把它从 feeOther 里排除，避免重复）
```

- 7 项全部参与表单记忆
- 旧的 `domesticFee` / `warehouseFee` 键不再写入

## 五、约束

- **不要启动任何服务**（8787 / 8790 在跑），**不要**跑 `dev:mp-weixin`
- 自测：
  1. 更新 `scripts/verify-incoterms.mjs` 与 `verify-manualprice.mjs`：默认明细合计 = 2000 时，各术语价格与改动前**逐字节一致**（这是回归基线）；改动任一项明细，合计与价格同步变化；EXW 仍不含国内费用合计
  2. `npm run build:mp-weixin` 与 `npm run build:h5` 都要 Build complete
- 提交：`git -c user.email=dev@local -c user.name=dev commit -m "feat(quote): 国内费用拆分为 7 项明细，合计自动累加"`

## 六、汇报（中文）

改了哪些文件、7 项明细与默认值、合计如何进入计算、旧数据迁移规则、断言输出（含"默认合计 2000 → 价格不变"的证据）、两个 build 结果、遗留问题。
