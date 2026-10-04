// 临时自测脚本：在 Node 中直接跑 src/utils/incoterms.js 的纯函数
// 因 incoterms.js 依赖 calc.js / transport.js，这里把三个文件源码拼接后动态导入
// 用法：node scripts/verify-incoterms.mjs
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
  '\nexport { calcTermQuote, allocateItems, sumItems, termsForMode, defaultTerm, remapTerm, isValidTerm, termLabel, getIncoterm, termIncludes, INCOTERMS, isSeaMode };'

const mod = await import('data:text/javascript,' + encodeURIComponent(src))
const { calcTermQuote, allocateItems, sumItems, termsForMode, defaultTerm, remapTerm, isValidTerm, termIncludes, INCOTERMS, isSeaMode } = mod

let pass = 0
let fail = 0
const TOL = 0.02

function ok(name, cond, extra = '') {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
}
function close(name, actual, expected, tol = TOL) {
  ok(name, Number.isFinite(actual) && Math.abs(actual - expected) <= tol, `实际=${actual} 期望≈${expected}`)
}
function gt(name, a, b) {
  ok(name, Number.isFinite(a) && Number.isFinite(b) && a > b, `${a} > ${b}`)
}
function eq(name, actual, expected) {
  ok(name, actual === expected, `实际=${actual} 期望=${expected}`)
}

// 国内费用 7 项明细默认值（与报价页一致）：合计 = 500+800+500+200 = 2000，与改动前打包的默认总成本一致
const FEE_DEFAULTS = {
  feeCustoms: 500, feeTrucking: 800, feePort: 500, feeDocs: 200,
  feeBank: 0, feeWarehouse: 0, feeOther: 0,
}
const FEE_KEYS = Object.keys(FEE_DEFAULTS)
const sumFees = (fees) => FEE_KEYS.reduce((s, k) => s + Number(fees[k] || 0), 0)
const DEFAULT_FEE_TOTAL = sumFees(FEE_DEFAULTS)
// 页面口径：把 7 项明细累加成单一 domesticFee 再送入计算（calcTermQuote 只认 domesticFee）
const withFees = (fees, extra = {}) => ({ ...DEFAULTS, ...extra, domesticFee: sumFees(fees) })

// 基线参数（沿用改动前的数值，作为「改动前价格」的基准；destinationFee 固定 800 不随页面默认值变）
// domesticFee 由 7 项明细累加得到（页面口径），公式与接口不变
const DEFAULTS = {
  price: 100, qty: 1000, vatRate: 13, rebateRate: 13, domesticFee: DEFAULT_FEE_TOTAL,
  exchangeRate: 7.1, profitRate: 10, freight: 500, insuranceRate: 0.3, markupRate: 10,
  destinationFee: 800, tariffRate: 5, importVatRate: 13,
}

console.log('===== 用例 1：11 种术语在默认参数下均为有限数 =====')
eq('术语总数', INCOTERMS.length, 11)
const byTerm = {}
for (const t of INCOTERMS) {
  const r = calcTermQuote({ ...DEFAULTS, tradeTerm: t.code })
  byTerm[t.code] = r
  const bad = Object.keys(r).filter((k) => typeof r[k] === 'number' && !Number.isFinite(r[k]))
  ok(`${t.code} 全部金额有限（无 NaN/Infinity）`, bad.length === 0, bad.length ? `异常字段=${bad.join(',')}` : '')
  ok(`${t.code} 单价/总价为有限数`, Number.isFinite(r.unitPrice) && Number.isFinite(r.totalPrice), `unit=${r.unitPrice} total=${r.totalPrice}`)
}
// 数量为 0 时不得出现 NaN
const zeroQty = calcTermQuote({ ...DEFAULTS, qty: 0, tradeTerm: 'CIF' })
ok('数量 0 → 单价为 0（非 NaN）', zeroQty.unitPrice === 0 && Number.isFinite(zeroQty.totalPrice))

console.log('\n===== 用例 2：术语层级大小关系 =====')
gt('DDP > DAP', byTerm.DDP.totalPrice, byTerm.DAP.totalPrice)
gt('DAP > CPT', byTerm.DAP.totalPrice, byTerm.CPT.totalPrice)
gt('CPT > FCA', byTerm.CPT.totalPrice, byTerm.FCA.totalPrice)
gt('CIF > CPT', byTerm.CIF.totalPrice, byTerm.CPT.totalPrice)
gt('EXW < FOB（EXW 不含国内费用）', byTerm.FOB.totalPrice, byTerm.EXW.totalPrice)
gt('CIP > CPT', byTerm.CIP.totalPrice, byTerm.CPT.totalPrice)
close('DPU 总价 = DAP 总价（卸货费含在目的地费用里）', byTerm.DPU.totalPrice, byTerm.DAP.totalPrice, 1e-9)

console.log('\n===== 用例 3：关键术语数值（默认参数）=====')
close('FCA/EXW 之外的基准 FCA 总价', byTerm.FCA.totalPrice, 14020.44)
close('FOB 总价（与 FCA 同基准）', byTerm.FOB.totalPrice, 14020.44)
close('EXW 总价（不含国内费用）', byTerm.EXW.totalPrice, 13710.58)
close('CPT 总价 = FCA + 运费', byTerm.CPT.totalPrice, 14520.44)
close('CIF 总价（CIF 口径到岸价）', byTerm.CIF.totalPrice, 14568.53)
close('DAP 总价 = FCA + 运费 + 目的地费用', byTerm.DAP.totalPrice, 15320.44)
close('DDP 关税 = CIF 到岸价 × 关税率', byTerm.DDP.tariff, 728.43)
close('DDP 总价 = DAP + 关税 + 进口增值税', byTerm.DDP.totalPrice, 18037.47)
close('换汇成本（固定 FOB 口径）', byTerm.DDP.exchangeCost, 6.4546)
close('盈亏率（固定 FOB 口径）', byTerm.EXW.profitPct, 10.0)
ok('换汇成本不随术语变化', Math.abs(byTerm.DDP.exchangeCost - byTerm.EXW.exchangeCost) < 1e-9)
ok('EXW 的货值成本 = 货值成本(不含国内)', byTerm.EXW.costBase < byTerm.FCA.costBase)

console.log('\n===== 用例 4：按运输方式过滤 =====')
const seaModes = ['SEA_FCL', 'SEA_LCL', 'SEA_BULK', 'INLAND']
const otherModes = ['AIR', 'EXPRESS', 'POST', 'RAIL', 'ROAD', 'PIPELINE', 'LAND_BRIDGE', 'MULTIMODAL']
for (const m of seaModes) {
  eq(`海运 ${m} 可选 11 种`, termsForMode(m).length, 11)
  eq(`海运 ${m} 默认术语 FOB`, defaultTerm(m), 'FOB')
}
const nonSeaCodes = termsForMode('AIR').map((t) => t.code)
for (const m of otherModes) {
  eq(`非海运 ${m} 可选 7 种`, termsForMode(m).length, 7)
  eq(`非海运 ${m} 默认术语 FCA`, defaultTerm(m), 'FCA')
  ok(`非海运 ${m} 不含海运专属术语`, !termsForMode(m).some((t) => ['FAS', 'FOB', 'CFR', 'CIF'].includes(t.code)))
}
eq('非海运可选项', nonSeaCodes.join(','), 'EXW,FCA,CPT,CIP,DAP,DPU,DDP')
ok('FOB 不适用于空运', !isValidTerm('FOB', 'AIR'))
ok('FCA 适用于空运', isValidTerm('FCA', 'AIR'))
ok('CIF 适用于海运', isValidTerm('CIF', 'SEA_FCL'))

console.log('\n===== 用例 5：运输方式切换时的术语映射 =====')
eq('海运 FOB → 空运 得 FCA', remapTerm('FOB', 'SEA_FCL', 'AIR'), 'FCA')
eq('海运 CFR → 空运 得 CPT', remapTerm('CFR', 'SEA_FCL', 'AIR'), 'CPT')
eq('海运 CIF → 空运 得 CIP', remapTerm('CIF', 'SEA_FCL', 'AIR'), 'CIP')
eq('海运 FAS → 空运 得 FCA', remapTerm('FAS', 'SEA_FCL', 'AIR'), 'FCA')
eq('海运 EXW → 空运 保留 EXW', remapTerm('EXW', 'SEA_FCL', 'AIR'), 'EXW')
eq('空运 FCA → 海运 得 FOB', remapTerm('FCA', 'AIR', 'SEA_FCL'), 'FOB')
eq('空运 CPT → 海运 得 CFR', remapTerm('CPT', 'AIR', 'SEA_FCL'), 'CFR')
eq('空运 CIP → 海运 得 CIF', remapTerm('CIP', 'AIR', 'SEA_FCL'), 'CIF')
eq('DDP 跨方式保留', remapTerm('DDP', 'AIR', 'SEA_FCL'), 'DDP')
eq('海运内部切换 FOB 保留', remapTerm('FOB', 'SEA_FCL', 'SEA_LCL'), 'FOB')
eq('非法术语回退目标方式默认（海运→FOB）', remapTerm('EXPRESS_ONLY_X', 'AIR', 'SEA_FCL'), 'FOB')
eq('非法术语回退目标方式默认（非海运→FCA）', remapTerm('SEA_ONLY_X', 'SEA_FCL', 'AIR'), 'FCA')

console.log('\n===== 用例 6：费用计入项 =====')
eq('CIF 计入运费+保险，不计目的地', JSON.stringify(termIncludes('CIF')), JSON.stringify({ carriage: true, insurance: true, destination: false, duty: false }))
eq('FOB 四项全不计入', JSON.stringify(termIncludes('FOB')), JSON.stringify({ carriage: false, insurance: false, destination: false, duty: false }))
eq('DDP 计入运费+目的地+税费，不计保险', JSON.stringify(termIncludes('DDP')), JSON.stringify({ carriage: true, insurance: false, destination: true, duty: true }))
eq('海运判定 SEA_FCL', isSeaMode('SEA_FCL'), true)
eq('海运判定 MULTIMODAL 为非海运', isSeaMode('MULTIMODAL'), false)

console.log('\n===== 用例 7：默认明细合计 = 2000 → 各术语价格与改动前逐字节一致 =====')
eq('7 项明细默认合计 = 2000', DEFAULT_FEE_TOTAL, 2000)
// 改动前硬编码基线（与用例 3 同源）：把 7 项累加当作单一 domesticFee 传入后必须复现
const LEGACY_TOTALS = {
  FCA: 14020.44, FOB: 14020.44, EXW: 13710.58, CPT: 14520.44,
  CIF: 14568.53, DAP: 15320.44, DDP: 18037.47,
}
for (const t of INCOTERMS) {
  const r = calcTermQuote(withFees(FEE_DEFAULTS, { tradeTerm: t.code }))
  if (LEGACY_TOTALS[t.code] !== undefined) {
    close(`${t.code} 默认合计 → 复现改动前总价`, r.totalPrice, LEGACY_TOTALS[t.code])
  }
  // 与「旧接口：直接传 2000」逐字节比对（浮点严格相等）
  const bundled = calcTermQuote({ ...DEFAULTS, tradeTerm: t.code })
  ok(`${t.code} 明细累加 ≡ 旧打包输入（逐字节）`,
    r.totalPrice === bundled.totalPrice && r.costBase === bundled.costBase && r.unitPrice === bundled.unitPrice,
    `明细=${r.totalPrice} 打包=${bundled.totalPrice}`)
}

console.log('\n===== 用例 8：改动任一项明细 → 合计与价格同步变化，EXW 仍不含国内费用 =====')
// 隔离利润率/保险/税费对基准价的放大：置 profitRate=0、保险/关税/增值税率=0，
// 则各非 EXW 术语总价 = 基准价 + 固定运费/目的地费，基准价增加 = 明细增量/汇率，
// 故总价增加恰为 1200 / 汇率（外币）。
const PURE = {
  profitRate: 0, insuranceRate: 0, markupRate: 0,
  tariffRate: 0, importVatRate: 0, destinationFee: 0,
}
const DELTA = 1200
const dForeign = DELTA / DEFAULTS.exchangeRate // ≈169.0141 外币
// 只改「拖车费」一项：合计 +1200
const bumpedFees = { ...FEE_DEFAULTS, feeTrucking: FEE_DEFAULTS.feeTrucking + DELTA }
eq('改拖车费 +1200 → 明细合计增加 1200', sumFees(bumpedFees) - DEFAULT_FEE_TOTAL, DELTA)
for (const t of INCOTERMS) {
  const a = calcTermQuote(withFees(FEE_DEFAULTS, { ...PURE, tradeTerm: t.code }))
  const b = calcTermQuote(withFees(bumpedFees, { ...PURE, tradeTerm: t.code }))
  if (t.code === 'EXW') {
    close('EXW 明细 +1200 → 总价不变', b.totalPrice, a.totalPrice, 1e-9)
    close('EXW 明细 +1200 → 成本基准不变', b.costBase, a.costBase, 1e-9)
    ok('EXW 不含国内费用合计（includesDomestic=false）', b.includesDomestic === false)
  } else {
    close(`${t.code} 明细 +1200 → 总价增加 1200/汇率`, b.totalPrice - a.totalPrice, dForeign, 1e-6)
    close(`${t.code} 明细 +1200 → 成本基准增加 1200 ¥`, b.costBase - a.costBase, DELTA, 1e-9)
  }
}
// 默认参数下（含利润率与保险放大）：EXW 不变，所有非 EXW 术语总价增加
for (const t of INCOTERMS) {
  const a = calcTermQuote(withFees(FEE_DEFAULTS, { tradeTerm: t.code }))
  const b = calcTermQuote(withFees(bumpedFees, { tradeTerm: t.code }))
  if (t.code === 'EXW') {
    ok('默认参数 EXW 明细变化不影响总价', Math.abs(b.totalPrice - a.totalPrice) < 1e-9, `Δ=${b.totalPrice - a.totalPrice}`)
  } else {
    gt(`默认参数 ${t.code} 明细计入 → 总价增加`, b.totalPrice, a.totalPrice)
  }
}

console.log('\n===== 用例 9：多产品明细 —— 各行按自身税率算货值，合计 = Σ 各行 =====')
// 3 行，各自不同的增值税率/退税率，验证「退税额/件 用该行税率」而非整单
const ITEMS = [
  { productName: '主产品', qty: 1000, price: 100, vatRate: 13, rebateRate: 13 },
  { productName: '配件', qty: 500, price: 200, vatRate: 9, rebateRate: 9 },
  { productName: '包装', qty: 200, price: 50, vatRate: 6, rebateRate: 0 },
]
const lineGoods = (it) => (it.price - it.price / (1 + it.vatRate / 100) * (it.rebateRate / 100)) * it.qty
const sumGoods = ITEMS.reduce((s, it) => s + lineGoods(it), 0)
const sumQty = ITEMS.reduce((s, it) => s + it.qty, 0)
const rItems = calcTermQuote({ ...DEFAULTS, items: ITEMS, tradeTerm: 'FOB' })
close('多行货值 = Σ 各行货值', rItems.goodsValue, sumGoods, 1e-6)
eq('多行总数量 = Σ 各行数量', rItems.qty, 1700)
ok('多行货值 ≠ 直接把首行税率套用到整单',
  Math.abs(rItems.goodsValue - ((100 - 100 / 1.13 * 0.13) * sumQty)) > 1,
  `多行=${rItems.goodsValue.toFixed(2)} 首行口径=${((100 - 100 / 1.13 * 0.13) * sumQty).toFixed(2)}`)
// 与「等效单行」（税率置 0、单价 = 总货值/总数量）总价一致
const rEquiv = calcTermQuote({ ...DEFAULTS, price: sumGoods / sumQty, qty: sumQty, vatRate: 0, rebateRate: 0, tradeTerm: 'FOB' })
close('多行 ≡ 等效单行（货值相同 → 总价相同）', rItems.totalPrice, rEquiv.totalPrice, 1e-6)
// 多行下所有结果字段均有限
const badItems = Object.keys(rItems).filter((k) => typeof rItems[k] === 'number' && !Number.isFinite(rItems[k]))
ok('多行结果全部数值有限', badItems.length === 0, badItems.join(','))
// 数量全为 0 → 不得出现 NaN
const zItems = calcTermQuote({ ...DEFAULTS, items: ITEMS.map((it) => ({ ...it, qty: 0 })), tradeTerm: 'FOB' })
ok('多行数量 0 → 单价有限且为 0', zItems.unitPrice === 0 && Number.isFinite(zItems.totalPrice))

// 单行 items ≡ 扁平字段（逐字节）——页面默认就是 1 行明细，升级后数值必须与改动前完全一致
const oneFlat = calcTermQuote({ ...DEFAULTS, tradeTerm: 'CIF' })
const oneItems = calcTermQuote({
  ...DEFAULTS, tradeTerm: 'CIF',
  items: [{ productName: '', qty: DEFAULTS.qty, price: DEFAULTS.price, vatRate: DEFAULTS.vatRate, rebateRate: DEFAULTS.rebateRate }],
})
ok('单行 items ≡ 扁平字段（逐字节）',
  oneItems.totalPrice === oneFlat.totalPrice && oneItems.unitPrice === oneFlat.unitPrice && oneItems.goodsValue === oneFlat.goodsValue,
  `items=${oneItems.totalPrice} flat=${oneFlat.totalPrice}`)

console.log('\n===== 用例 10：按货值占比分摊 —— 单价×数量=金额、每行≤容差、位数 2~6 =====')
const round2 = (v) => Math.round(safeNum(v) * 100) / 100
const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
// 每行容差：max(0.01, 分摊额 × 0.1%)（自动模式 2 位小数的允许偏差）
const lineTol = (amount) => Math.max(0.01, Math.abs(amount) * 0.001)
const TOTAL10 = 14020.44
const goodsLine = ITEMS.map(lineGoods)
const goodsSum = goodsLine.reduce((s, v) => s + v, 0)
const allocReal = goodsLine.map((g) => TOTAL10 * (g / goodsSum)) // 该行真实分摊额
// 自动模式（manual=false）：不做最后一行兜底
const rows = allocateItems(ITEMS, TOTAL10)
// 1. 每行 round(单价×数量,2) === 金额
ok('多行：每行 round(单价×数量,2) === 金额',
  rows.every((r) => round2(r.unitPrice * r.qty) === r.totalPrice),
  rows.map((r) => `${r.unitPrice}×${r.qty}=${round2(r.unitPrice * r.qty)}≠${r.totalPrice}`).join(' | '))
// 2. 自动模式：整单总价（Σ 行金额）严格 = sumItems（无兜底，Σ 即口径）
ok('自动模式：Σ 行金额 === 整单总价（严格，整单总价 = Σ 行金额）',
  sumItems(rows) === round2(rows.reduce((s, r) => s + r.totalPrice, 0)),
  `Σ=${sumItems(rows)}`)
// 3. 自动模式：每行 |金额 − 真实分摊额| ≤ max(0.01, 分摊额 × 0.1%)（本次核心断言）
ok('自动模式：每行 |金额 − 真实分摊额| ≤ max(0.01, 分摊额×0.1%)',
  rows.every((r, i) => Math.abs(r.totalPrice - allocReal[i]) <= lineTol(allocReal[i])),
  rows.map((r, i) => `#${i + 1} ${r.totalPrice} vs ${allocReal[i].toFixed(4)} tol=${lineTol(allocReal[i]).toFixed(4)}`).join(' | '))
// 4. 单价位数按需自适应，落在 2~6 位
ok('多行：单价位数均在 2~6 位',
  rows.every((r) => Number.isInteger(r.decimals) && r.decimals >= 2 && r.decimals <= 6),
  rows.map((r) => r.decimals).join(','))
ok('产品名透传', rows[1].productName === '配件')
// 5. 单行：单价×数量=金额，且常规价用 2 位（14000/1000=14，2 位即够）
const oneRow = allocateItems([{ productName: '单', qty: 1000, price: 100, vatRate: 13, rebateRate: 13 }], 14000)
ok('单行：单价 × 数量 === 金额', Math.abs(oneRow[0].unitPrice * oneRow[0].qty - oneRow[0].totalPrice) < 1e-9,
  `${oneRow[0].unitPrice}×1000=${oneRow[0].totalPrice}`)
ok('单行：整数单价用 2 位（位数取最小）', oneRow[0].decimals === 2, `decimals=${oneRow[0].decimals} unit=${oneRow[0].unitPrice}`)
// 5b. 低单价大批量：0.4734 × 200000 误差 ≤ 0.01（旧版 0.47 会差 $680）
const bigQty = allocateItems([{ productName: '袋', qty: 200000, price: 100, vatRate: 13, rebateRate: 13 }], 94680)
close('低单价大批量：行金额误差 ≤ 0.01（0.4734×200000）', bigQty[0].totalPrice, 94680, 0.01)
ok('低单价大批量：单价位数上浮到 4 位', bigQty[0].decimals === 4, `decimals=${bigQty[0].decimals} unit=${bigQty[0].unitPrice}`)
// 5c. EVA 收纳袋：2000 件真实分摊 $946.89（2 位 0.47 → 940 少算 6.89，偏差 0.73% > 0.1%）
const eva = allocateItems([{ productName: 'EVA', qty: 2000, price: 100, vatRate: 13, rebateRate: 13 }], 946.89)
ok('低价中批量：2000 件 $946.89 位数 ≥ 4 且误差 ≤ 0.01',
  eva[0].decimals >= 4 && Math.abs(eva[0].totalPrice - 946.89) <= 0.01,
  `unit=${eva[0].unitPrice} d=${eva[0].decimals} total=${eva[0].totalPrice} 旧版=0.47×2000=940`)
// 6. 手动定价：Σ 行金额 严格等于手填总价，最后一行兜底
const manualRows = allocateItems(ITEMS, 100.01, true)
ok('手动定价：Σ 行金额 === 手填总价（严格相等）', sumItems(manualRows) === 100.01, `Σ=${sumItems(manualRows)}`)
ok('手动定价：最后一行 = 手填总价 − 前面各行之和',
  Math.abs(manualRows[manualRows.length - 1].totalPrice - (100.01 - manualRows.slice(0, -1).reduce((s, r) => s + r.totalPrice, 0))) < 1e-9)
ok('手动定价：前 n-1 行 round(单价×数量,2)=金额',
  manualRows.slice(0, -1).every((r) => round2(r.unitPrice * r.qty) === r.totalPrice))
// 7. 数量 0 / 货值 0：占比 0 → 单价/金额为 0，不得 NaN
const zQtyRows = allocateItems(ITEMS.map((it) => ({ ...it, qty: 0 })), 1000)
ok('多行数量 0 → 行单价/行金额为 0 且有限（无 NaN）',
  zQtyRows.every((r) => r.unitPrice === 0 && r.totalPrice === 0))
const zeroGoods = allocateItems([{ productName: 'x', qty: 3, price: 0, vatRate: 13, rebateRate: 13 }], 500)
ok('货值 0 → 占比 0，行单价/行金额为 0（无 NaN）',
  zeroGoods[0].unitPrice === 0 && zeroGoods[0].totalPrice === 0)
eq('空明细 → 空结果', allocateItems([], 100).length, 0)

console.log('\n===== 用例 11：自动/手动两种模式在任意总价下均成立 =====')
for (const t of [0.47, 14.80, 1234.567]) {
  const T = Math.round(t * 100) / 100
  const goodsR = ITEMS.map(lineGoods)
  const gSum = goodsR.reduce((s, v) => s + v, 0)
  // 自动模式：无兜底，Σ 即整单总价口径；每行 ≤ max(0.01, 分摊额×0.1%)
  const autoR = allocateItems(ITEMS, t, false)
  ok(`自动 $${t} 每行 round(单价×数量,2)=金额`,
    autoR.every((r) => round2(r.unitPrice * r.qty) === r.totalPrice),
    autoR.map((r) => `${r.unitPrice}×${r.qty}=${r.totalPrice}`).join(' | '))
  ok(`自动 $${t} Σ 行金额 === 整单总价（严格，= Σ 行金额）`,
    sumItems(autoR) === round2(autoR.reduce((s, r) => s + r.totalPrice, 0)), `Σ=${sumItems(autoR)}`)
  ok(`自动 $${t} 每行 |金额 − 真实分摊额| ≤ max(0.01, 分摊额×0.1%)`,
    autoR.every((r, i) => Math.abs(r.totalPrice - T * (goodsR[i] / gSum)) <= lineTol(T * (goodsR[i] / gSum))),
    autoR.map((r, i) => `#${i + 1} ${r.totalPrice} vs ${(T * (goodsR[i] / gSum)).toFixed(4)}`).join(' | '))
  // 手动模式：兜底，Σ 严格 = 手填总价
  const manR = allocateItems(ITEMS, t, true)
  ok(`手动 $${t} Σ 行金额 === 手填总价（严格相等）`, sumItems(manR) === T, `Σ=${sumItems(manR)} 期望=${T}`)
  ok(`手动 $${t} 每行 round(单价×数量,2)=金额`,
    manR.every((r) => round2(r.unitPrice * r.qty) === r.totalPrice),
    manR.map((r) => `${r.unitPrice}×${r.qty}=${r.totalPrice}`).join(' | '))
  // 单行：单价×数量=金额
  const one = allocateItems([{ productName: '单', qty: 1000, price: 100, vatRate: 13, rebateRate: 13 }], t)
  ok(`$${t} 单行 单价×数量=金额`, Math.abs(one[0].unitPrice * one[0].qty - one[0].totalPrice) < 1e-9,
    `${one[0].unitPrice}×1000=${one[0].totalPrice}`)
}

console.log('\n===== 用例 12：TASK-PRICE2 五场景 —— 2 位优先、低价值才升位 =====')
// 场景 1/2：单产品大批量、常规单价 → 2 位；金额 = round(单价×数量,2)
const s1 = allocateItems([{ productName: 'P', qty: 1000, price: 100, vatRate: 13, rebateRate: 13 }], 14847.29)
eq('场景1 单价 = 14.85（2 位）', s1[0].unitPrice, 14.85)
eq('场景1 金额 = 14850.00', s1[0].totalPrice, 14850)
const s2 = allocateItems([{ productName: 'P', qty: 1000, price: 100, vatRate: 13, rebateRate: 13 }], 15398.10)
eq('场景2 单价 = 15.40（2 位）', s2[0].unitPrice, 15.4)
eq('场景2 金额 = 15400.00', s2[0].totalPrice, 15400)
// 场景 3：EVA 2000 件 $946.89 —— 2 位偏差 0.73% > 0.1%，升位；位数 ≥ 4 且误差 ≤ 1 分
const s3 = allocateItems([{ productName: 'EVA', qty: 2000, price: 100, vatRate: 13, rebateRate: 13 }], 946.89)
ok('场景3 位数 ≥ 4 且 |金额 − 分摊额| ≤ 0.01', s3[0].decimals >= 4 && Math.abs(s3[0].totalPrice - 946.89) <= 0.01,
  `unit=${s3[0].unitPrice} d=${s3[0].decimals} total=${s3[0].totalPrice}`)
// 场景 4：低价袋 200000 件 $94680 —— 2 位偏差 0.72% > 0.1%，升到 4 位
const s4 = allocateItems([{ productName: '袋', qty: 200000, price: 100, vatRate: 13, rebateRate: 13 }], 94680)
eq('场景4 单价 = 0.4734（4 位）', s4[0].unitPrice, 0.4734)
eq('场景4 位数 = 4', s4[0].decimals, 4)
eq('场景4 金额 = 94680.00', s4[0].totalPrice, 94680)
// 场景 5：手动 30000（多行）—— 兜底保证 Σ 严格 = 30000.00
const s5 = allocateItems(ITEMS, 30000, true)
eq('场景5 手动 Σ 行金额 = 30000.00（严格）', sumItems(s5), 30000)
ok('场景5 每行 round(单价×数量,2)=金额', s5.every((r) => round2(r.unitPrice * r.qty) === r.totalPrice),
  s5.map((r) => `${r.unitPrice}×${r.qty}=${r.totalPrice}`).join(' | '))

console.log(`\n===== 汇总：PASS=${pass}  FAIL=${fail} =====`)
process.exit(fail === 0 ? 0 : 1)
