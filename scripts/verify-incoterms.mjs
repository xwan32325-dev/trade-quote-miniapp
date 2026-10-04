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
  '\nexport { calcTermQuote, allocateItems, termsForMode, defaultTerm, remapTerm, isValidTerm, termLabel, getIncoterm, termIncludes, INCOTERMS, isSeaMode };'

const mod = await import('data:text/javascript,' + encodeURIComponent(src))
const { calcTermQuote, allocateItems, termsForMode, defaultTerm, remapTerm, isValidTerm, termIncludes, INCOTERMS, isSeaMode } = mod

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

console.log('\n===== 用例 10：按货值占比分摊整单总价 =====')
const rows = allocateItems(ITEMS, 14020.44)
close('各行金额合计 = 整单总价（严格相等）', rows.reduce((s, r) => s + r.totalPrice, 0), 14020.44, 1e-9)
close('第 1 行金额 = 整单 × 货值占比', rows[0].totalPrice, Math.round(14020.44 * (lineGoods(ITEMS[0]) / sumGoods) * 100) / 100, 1e-9)
close('第 1 行单价 = 行金额 / 行数量', rows[0].unitPrice, Math.round((rows[0].totalPrice / 1000) * 100) / 100, 1e-9)
ok('行单价 / 行金额均保留 2 位小数', rows.every((r) => Math.abs(r.unitPrice * 100 - Math.round(r.unitPrice * 100)) < 1e-9 && Math.abs(r.totalPrice * 100 - Math.round(r.totalPrice * 100)) < 1e-9))
ok('产品名透传', rows[1].productName === '配件')
// 三行等分 100 → 四舍五入后合计仍恰为 100（最后一行兜底）
const third = allocateItems([
  { productName: 'a', qty: 1, price: 1, vatRate: 0, rebateRate: 0 },
  { productName: 'b', qty: 1, price: 1, vatRate: 0, rebateRate: 0 },
  { productName: 'c', qty: 1, price: 1, vatRate: 0, rebateRate: 0 },
], 100)
close('三行等分 100 → 合计恰为 100', third.reduce((s, r) => s + r.totalPrice, 0), 100, 1e-9)
close('最后一行 = 整单 − 前两行之和', third[2].totalPrice, 100 - third[0].totalPrice - third[1].totalPrice, 1e-9)
// 整单货值为 0 → 占比 0，不得 NaN/Infinity
const zeroGoods = allocateItems([{ productName: 'x', qty: 3, price: 0, vatRate: 13, rebateRate: 13 }], 500)
ok('货值 0 → 行单价/行金额有限（无 NaN）', Number.isFinite(zeroGoods[0].unitPrice) && Number.isFinite(zeroGoods[0].totalPrice))
close('货值 0、单行 → 金额兜底为整单总价，合计对得上', zeroGoods[0].totalPrice, 500, 1e-9)
eq('空明细 → 空结果', allocateItems([], 100).length, 0)

console.log(`\n===== 汇总：PASS=${pass}  FAIL=${fail} =====`)
process.exit(fail === 0 ? 0 : 1)
