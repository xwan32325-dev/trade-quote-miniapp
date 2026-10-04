// 临时自测脚本：在 Node 中直接跑 src/utils/incoterms.js 的手动定价反算
// incoterms.js 依赖 calc.js / transport.js，这里把三个文件源码拼接后动态导入
// 用法：node scripts/verify-manualprice.mjs
import { readFileSync } from 'node:fs'

function load(rel) {
  return readFileSync(new URL(rel, import.meta.url), 'utf8')
    .replace(/^\s*import\b.*$/gm, '') // 去掉 import 语句（拼接后同处一个作用域）
    .replace(/^\s*export\s+/gm, '') // 去掉 export 关键字
}

const src =
  [
    load('../src/utils/calc.js'),
    load('../src/utils/transport.js'),
    load('../src/utils/incoterms.js'),
  ].join('\n') +
  '\nexport { calcTermQuote, calcManualTermQuote, allocateItems, sumItems, INCOTERMS };'

const mod = await import('data:text/javascript,' + encodeURIComponent(src))
const { calcTermQuote, calcManualTermQuote, allocateItems, sumItems, INCOTERMS } = mod

let pass = 0
let fail = 0
const TOL = 1e-6

function ok(name, cond, extra = '') {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
}
function close(name, actual, expected, tol = TOL) {
  ok(name, Number.isFinite(actual) && Math.abs(actual - expected) <= tol, `实际=${actual} 期望≈${expected}`)
}
function finite(name, actual) {
  ok(name, Number.isFinite(actual), `实际=${actual}`)
}

// 国内费用 7 项明细默认值（与报价页一致）：合计 = 2000
const FEE_DEFAULTS = {
  feeCustoms: 500, feeTrucking: 800, feePort: 500, feeDocs: 200,
  feeBank: 0, feeWarehouse: 0, feeOther: 0,
}
const FEE_KEYS = Object.keys(FEE_DEFAULTS)
const sumFees = (fees) => FEE_KEYS.reduce((s, k) => s + Number(fees[k] || 0), 0)

// 默认参数（与报价页默认值一致）；domesticFee 由 7 项明细累加得到
const D = {
  price: 100, qty: 1000, vatRate: 13, rebateRate: 13, domesticFee: sumFees(FEE_DEFAULTS),
  exchangeRate: 7.1, profitRate: 10, freight: 500, insuranceRate: 0.3, markupRate: 10,
  destinationFee: 800, tariffRate: 5, importVatRate: 13,
}
// 页面口径：7 项明细累加成单一 domesticFee 再送入计算（calcManualTermQuote 只认 domesticFee）
const withFees = (fees, extra = {}) => ({ ...D, ...extra, domesticFee: sumFees(fees) })

console.log('===== 用例 1：11 种术语手动定价均无 NaN/Infinity =====')
for (const t of INCOTERMS) {
  const r = calcManualTermQuote({ ...D, tradeTerm: t.code }, 20)
  const bad = Object.keys(r).filter((k) => typeof r[k] === 'number' && !Number.isFinite(r[k]))
  ok(`${t.code} 全部数值有限`, bad.length === 0, bad.length ? `异常字段=${bad.join(',')}` : '')
}
// 数量 0 / 汇率 0 两个除零边界
for (const t of INCOTERMS) {
  const zq = calcManualTermQuote({ ...D, tradeTerm: t.code, qty: 0 }, 20)
  const zr = calcManualTermQuote({ ...D, tradeTerm: t.code, exchangeRate: 0 }, 20)
  const badQ = Object.keys(zq).filter((k) => typeof zq[k] === 'number' && !Number.isFinite(zq[k]))
  const badR = Object.keys(zr).filter((k) => typeof zr[k] === 'number' && !Number.isFinite(zr[k]))
  ok(`${t.code} 数量 0 无 NaN`, badQ.length === 0, badQ.join(','))
  ok(`${t.code} 汇率 0 无 NaN`, badR.length === 0, badR.join(','))
}

console.log('\n===== 用例 2：手动价 = 成本价 → 成本加成率 0，盈亏率同按成本计算 =====')
// 利润率置 0 时，「按成本计算价」即成本基准价，两者可比
const base0 = calcTermQuote({ ...D, tradeTerm: 'FOB', profitRate: 0 })
const m0 = calcManualTermQuote({ ...D, tradeTerm: 'FOB', profitRate: 0 }, base0.unitPrice)
close('FOB 手动价=成本价 → 成本加成率 0', m0.markupPct, 0, 1e-9)
close('FOB 手动价=成本价 → 盈亏率 = 按成本计算(0)', m0.profitPct, base0.profitPct, 1e-9)
close('FOB 手动价=成本价 → 利润额 0', m0.profitAmount, 0, 1e-6)

console.log('\n===== 用例 3：手动价 = 成本价 × 1.2 → 成本加成率 ≈ 20% =====')
const m12 = calcManualTermQuote({ ...D, tradeTerm: 'FOB' }, base0.unitPrice * 1.2)
close('成本加成率 ≈ 20', m12.markupPct, 20, 1e-6)
close('利润额 = 0.2 × 成本基准', m12.profitAmount, 0.2 * m12.costTotal, 1e-6)
// 手动价 = 按成本计算价（利润率 10）→ 成本加成率=10 且盈亏率与按成本计算一致
const autoFob = calcTermQuote({ ...D, tradeTerm: 'FOB' })
const mAuto = calcManualTermQuote({ ...D, tradeTerm: 'FOB' }, autoFob.unitPrice)
close('手动价=按成本计算价 → 成本加成率=10', mAuto.markupPct, 10, 1e-6)
close('手动价=按成本计算价 → 盈亏率 = 按成本计算(10)', mAuto.profitPct, autoFob.profitPct, 1e-6)

console.log('\n===== 用例 4：手动价低于成本 → 利润额为负、标记低于成本 =====')
const mHalf = calcManualTermQuote({ ...D, tradeTerm: 'FOB' }, base0.unitPrice * 0.5)
ok('利润额为负', mHalf.profitAmount < 0, `profitAmount=${mHalf.profitAmount}`)
ok('成本加成率为负', mHalf.markupPct < 0, `markupPct=${mHalf.markupPct}`)
ok('belowCost 标记为真', mHalf.belowCost === true)
close('shortfall = -利润额', mHalf.shortfall, -mHalf.profitAmount, 1e-6)
ok('盈亏率为负', mHalf.profitPct < 0, `profitPct=${mHalf.profitPct}`)

console.log('\n===== 用例 5：FOB 净收入按术语扣减附加费用（方向正确）=====')
const U = 20
const bFob = calcTermQuote({ ...D, tradeTerm: 'FOB', profitRate: 0 })
const bCfr = calcTermQuote({ ...D, tradeTerm: 'CFR', profitRate: 0 })
const bDap = calcTermQuote({ ...D, tradeTerm: 'DAP', profitRate: 0 })
const bDdp = calcTermQuote({ ...D, tradeTerm: 'DDP', profitRate: 0 })
const mFob = calcManualTermQuote({ ...D, tradeTerm: 'FOB' }, U)
const mCfr = calcManualTermQuote({ ...D, tradeTerm: 'CFR' }, U)
const mCif = calcManualTermQuote({ ...D, tradeTerm: 'CIF' }, U)
const mDap = calcManualTermQuote({ ...D, tradeTerm: 'DAP' }, U)
const mDdp = calcManualTermQuote({ ...D, tradeTerm: 'DDP' }, U)
const mExw = calcManualTermQuote({ ...D, tradeTerm: 'EXW' }, U)

close('FAS/FOB/FCA 附加费用 = 0', mFob.extra, 0, 1e-9)
close('CFR 附加费用 = 运费', mCfr.extra, bCfr.freight, 1e-9)
close('CIF 附加费用 = 运费 + 保险(按手动总价)', mCif.extra, bCfr.freight + U * D.qty * (D.insuranceRate / 100) * (1 + D.markupRate / 100), 1e-6)
close('DAP 附加费用 = 运费 + 目的地费用', mDap.extra, bDap.freight + bDap.destinationFee, 1e-9)
close('DDP 附加费用 = 运费+目的地+关税+进口增值税', mDdp.extra, bDdp.freight + bDdp.destinationFee + bDdp.tariff + bDdp.importVat, 1e-6)
close('EXW 附加费用 = -国内费用/汇率', mExw.extra, -(D.domesticFee / D.exchangeRate), 1e-9)
close('EXW FOB 净收入 = 手动总价 + 国内费用/汇率', mExw.fobNet, U * D.qty - mExw.extra, 1e-9)
// 展示的费用明细也须沿用置 0 的成本基准，才能与 FOB 净收入扣减口径一致
close('DDP 展示关税沿用成本基准', mDdp.tariff, bDdp.tariff, 1e-9)
close('DDP 展示进口增值税沿用成本基准', mDdp.importVat, bDdp.importVat, 1e-9)
// FOB 净收入 = 手动总价 - 附加费用
close('DDP FOB 净收入 = 手动总价 - 附加费用', mDdp.fobNet, U * D.qty - mDdp.extra, 1e-6)
// 手动价定为 DDP 成本价时，FOB 净收入应近似等于含国内成本/汇率
close('DDP 手动=成本价 → 换汇成本 ≈ 汇率', calcManualTermQuote({ ...D, tradeTerm: 'DDP' }, bDdp.unitPrice).exchangeCost, D.exchangeRate, 1e-6)
close('DDP 手动=成本价 → 盈亏率 ≈ 0', calcManualTermQuote({ ...D, tradeTerm: 'DDP' }, bDdp.unitPrice).profitPct, 0, 1e-6)

console.log('\n===== 用例 6：手动价=成本基准(U0)时，换汇成本/盈亏率与置0的按成本计算同口径 =====')
// 注：EXW/DDP 的附加费用/税费本身取自置 0 的成本基准，故只在利润率置 0 时两者才严格一致
for (const t of INCOTERMS) {
  const base = calcTermQuote({ ...D, tradeTerm: t.code, profitRate: 0 })
  const man = calcManualTermQuote({ ...D, tradeTerm: t.code, profitRate: 0 }, base.unitPrice)
  close(`${t.code} 手动=成本基准 → 盈亏率同按成本计算`, man.profitPct, base.profitPct, 1e-9)
  close(`${t.code} 手动=成本基准 → 换汇成本同按成本计算`, man.exchangeCost, base.exchangeCost, 1e-9)
}

console.log('\n===== 用例 7：除零边界返回 0 而非 NaN =====')
const zQty = calcManualTermQuote({ ...D, tradeTerm: 'DDP', qty: 0 }, 20)
finite('数量 0 成本加成率有限', zQty.markupPct)
finite('数量 0 换汇成本有限', zQty.exchangeCost)
finite('数量 0 盈亏率有限', zQty.profitPct)
const zRate = calcManualTermQuote({ ...D, tradeTerm: 'EXW', exchangeRate: 0 }, 20)
finite('汇率 0 换汇成本有限', zRate.exchangeCost)
finite('汇率 0 盈亏率有限', zRate.profitPct)
const zCost = calcManualTermQuote({ ...D, price: 0, domesticFee: 0, qty: 1000, tradeTerm: 'FOB' }, 5)
close('零成本时成本加成率返回 0', zCost.markupPct, 0, 1e-9)
finite('零成本时盈亏率有限', zCost.profitPct)

console.log('\n===== 用例 8：国内费用明细进手动定价成本基准 =====')
// 手动定价的成本基准走 calcTermQuote(profitRate=0)，7 项明细合计须一并进入
const bumpedFees = { ...FEE_DEFAULTS, feeTrucking: FEE_DEFAULTS.feeTrucking + 1200 }
const mD0 = calcManualTermQuote(withFees(FEE_DEFAULTS, { tradeTerm: 'FOB', profitRate: 0 }), 20)
const mD1 = calcManualTermQuote(withFees(bumpedFees, { tradeTerm: 'FOB', profitRate: 0 }), 20)
close('FOB 明细 +1200 → 出口总成本 +1200 ¥', mD1.exportCost - mD0.exportCost, 1200, 1e-9)
close('FOB 明细 +1200 → 成本基准总价 +1200/汇率', mD1.costTotal - mD0.costTotal, 1200 / D.exchangeRate, 1e-9)
// EXW 不含国内费用合计，其 FOB 净收入倒推须把 1200 的明细增量加回
const mDExw = calcManualTermQuote(withFees(bumpedFees, { tradeTerm: 'EXW' }), 20)
close('EXW 明细 +1200 → 附加费用 = -(明细合计)/汇率', mDExw.extra, -(sumFees(bumpedFees)) / D.exchangeRate, 1e-9)

console.log('\n===== 用例 9：多产品明细 —— 手动定价作用于整单总价 =====')
// 3 行明细，数量合计 1700；isTotal=true 时手填值即整单总价
const ITEMS = [
  { productName: '主产品', qty: 1000, price: 100, vatRate: 13, rebateRate: 13 },
  { productName: '配件', qty: 500, price: 200, vatRate: 9, rebateRate: 9 },
  { productName: '包装', qty: 200, price: 50, vatRate: 6, rebateRate: 0 },
]
const QTY = ITEMS.reduce((s, it) => s + it.qty, 0)
const mTotal = calcManualTermQuote({ ...D, items: ITEMS, tradeTerm: 'FOB' }, 5000, true)
close('isTotal=true → 手动总价 = 输入值', mTotal.manualTotal, 5000, 1e-9)
close('isTotal=true → 折算单价 = 输入值 / 明细总数量', mTotal.manualUnit, 5000 / QTY, 1e-9)
// isTotal=false（单产品口径）仍按单价 × 数量
const mUnit = calcManualTermQuote({ ...D, items: ITEMS, tradeTerm: 'FOB' }, 3, false)
close('isTotal=false → 手动总价 = 输入单价 × 明细总数量', mUnit.manualTotal, 3 * QTY, 1e-9)
// 成本基准来自 items（Σ 各行货值），不是首行 × 数量
const costItems = calcTermQuote({ ...D, items: ITEMS, tradeTerm: 'FOB', profitRate: 0 })
const lineGoods = (it) => (it.price - it.price / (1 + it.vatRate / 100) * (it.rebateRate / 100)) * it.qty
const sumGoods = ITEMS.reduce((s, it) => s + lineGoods(it), 0)
close('多行成本基准货值 = Σ 各行货值', costItems.goodsValue, sumGoods, 1e-6)
// 手填整单总价 = 成本基准总价（利润率置 0）→ 成本加成率 0
close('整单手动价=成本基准总价 → 成本加成率 0', calcManualTermQuote({ ...D, items: ITEMS, tradeTerm: 'FOB', profitRate: 0 }, costItems.unitPrice * QTY, true).markupPct, 0, 1e-9)
// 数量 0 边界不出现 NaN
const z = calcManualTermQuote({ ...D, items: ITEMS.map((it) => ({ ...it, qty: 0 })), tradeTerm: 'DDP' }, 100, true)
ok('多行数量 0 → 手动反算全部有限', Object.keys(z).every((k) => typeof z[k] !== 'number' || Number.isFinite(z[k])))

console.log('\n===== 用例 10：手动定价分摊 —— Σ 行金额 精确等于手填总价（保留兜底）=====')
// 用户手填「整单总价」时，分摊后必须严格对上：行金额 = round(行单价×行数量)，最后一行兜底
const round2 = (v) => Math.round(v * 100) / 100
for (const t of [0.47, 14.80, 1234.567, 5000]) {
  const T = Math.round(t * 100) / 100
  const rows = allocateItems(ITEMS, t, true)
  ok(`手填 $${t} → Σ 行金额 === 手填总价（严格相等）`, sumItems(rows) === T, `Σ=${sumItems(rows)} 期望=${T}`)
  ok(`手填 $${t} → 每行金额/单价有限（无 NaN）`,
    rows.every((r) => Number.isFinite(r.unitPrice) && Number.isFinite(r.totalPrice)))
  ok(`手填 $${t} → 每行 round(单价×数量,2)=金额`,
    rows.every((r) => round2(r.unitPrice * r.qty) === r.totalPrice))
  ok(`手填 $${t} → 最后一行 = 手填总价 − 前面各行之和`,
    Math.abs(rows[rows.length - 1].totalPrice - (T - rows.slice(0, -1).reduce((s, r) => s + r.totalPrice, 0))) < 1e-9)
}
// 单行手动 = 单价输入：页面把手填单价 × 数量 作为整单总价送入分摊 → 行单价 20、金额 20000
const oneRow = allocateItems([{ productName: '单', qty: 1000, price: 100, vatRate: 13, rebateRate: 13 }], 20 * 1000, true)
ok('单行手动：单价 × 数量 = 金额', oneRow[0].unitPrice === 20 && oneRow[0].totalPrice === 20000,
  `${oneRow[0].unitPrice}×1000=${oneRow[0].totalPrice}`)
// 数量 0 / 货值 0 边界：整单货值为 0 → 占比 0，各行金额为 0，不得 NaN
const zRows = allocateItems(ITEMS.map((it) => ({ ...it, qty: 0 })), 1000, true)
ok('手动多行数量 0 → 无 NaN 且各行金额为 0',
  zRows.every((r) => Number.isFinite(r.unitPrice) && Number.isFinite(r.totalPrice) && r.totalPrice === 0),
  `Σ=${sumItems(zRows)}`)

console.log('\n===== 用例 11：自动/手动在「兜底」上的差异（新规则）=====')
// 自动模式（manual=false）不兜底：Σ 行金额 = 各行金额之和（可能略偏离传入的整单总价）
const autoRows = allocateItems(ITEMS, 1234.57, false)
ok('自动模式：Σ 行金额 === 各行金额之和（无兜底，严格）',
  sumItems(autoRows) === round2(autoRows.reduce((s, r) => s + r.totalPrice, 0)), `Σ=${sumItems(autoRows)}`)
ok('自动模式：每行 round(单价×数量,2)=金额',
  autoRows.every((r) => round2(r.unitPrice * r.qty) === r.totalPrice))
// 手动模式有兜底：Σ 严格 = 手填总价
const manRows = allocateItems(ITEMS, 1234.57, true)
ok('手动模式：Σ 行金额 === 手填总价（严格相等）', sumItems(manRows) === 1234.57, `Σ=${sumItems(manRows)}`)
ok('手动模式最后一行被调整（与自动模式不同）',
  Math.abs(manRows[manRows.length - 1].totalPrice - autoRows[autoRows.length - 1].totalPrice) > 1e-9,
  `手动=${manRows[manRows.length - 1].totalPrice} 自动=${autoRows[autoRows.length - 1].totalPrice}`)
// 常规 2 位优先：EVA 2000 件 $946.89 → 位数 ≥ 4 且误差 ≤ 1 分（2 位只到 940，偏差 0.73%）
const eva = allocateItems([{ productName: 'EVA', qty: 2000, price: 100, vatRate: 13, rebateRate: 13 }], 946.89, false)
ok('低价中批量：2000 件 $946.89 位数 ≥ 4 且误差 ≤ 0.01',
  eva[0].decimals >= 4 && Math.abs(eva[0].totalPrice - 946.89) <= 0.01,
  `unit=${eva[0].unitPrice} d=${eva[0].decimals} total=${eva[0].totalPrice}`)
// 单产品大批量常规单价 → 2 位
const s1 = allocateItems([{ productName: 'P', qty: 1000, price: 100, vatRate: 13, rebateRate: 13 }], 14847.29, false)
ok('常规单价默认 2 位（14.85）', s1[0].decimals === 2 && s1[0].unitPrice === 14.85,
  `unit=${s1[0].unitPrice} d=${s1[0].decimals}`)

console.log(`\n===== 汇总：PASS=${pass}  FAIL=${fail} =====`)
process.exit(fail === 0 ? 0 : 1)
