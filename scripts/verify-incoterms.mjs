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
  '\nexport { calcTermQuote, termsForMode, defaultTerm, remapTerm, isValidTerm, termLabel, getIncoterm, termIncludes, INCOTERMS, isSeaMode };'

const mod = await import('data:text/javascript,' + encodeURIComponent(src))
const { calcTermQuote, termsForMode, defaultTerm, remapTerm, isValidTerm, termIncludes, INCOTERMS, isSeaMode } = mod

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

// 基线参数（沿用改动前的数值，作为「改动前价格」的基准；destinationFee 固定 800 不随页面默认值变）
const DEFAULTS = {
  price: 100, qty: 1000, vatRate: 13, rebateRate: 13, domesticFee: 2000,
  warehouseFee: 0, exchangeRate: 7.1, profitRate: 10, freight: 500, insuranceRate: 0.3, markupRate: 10,
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

console.log('\n===== 用例 7：仓储费默认 0 → 各术语价格与改动前一致 =====')
// DEFAULTS 已含 warehouseFee:0；逐个与用例 1 基线（改动前同参数结果）严格相等
for (const t of INCOTERMS) {
  const r = calcTermQuote({ ...DEFAULTS, tradeTerm: t.code, warehouseFee: 0 })
  close(`${t.code} 仓储费=0 → 总价与改动前一致`, r.totalPrice, byTerm[t.code].totalPrice, 1e-9)
  close(`${t.code} 仓储费=0 → 成本基准与改动前一致`, r.costBase, byTerm[t.code].costBase, 1e-9)
}

console.log('\n===== 用例 8：仓储费 = 1200 → 非 EXW 总价增加 1200/汇率，EXW 不变 =====')
// 隔离利润率/保险/税费对基准价的放大：置 profitRate=0、保险/关税/增值税率=0，
// 则各非 EXW 术语总价 = 基准价 + 固定运费/目的地费，基准价增加 = 仓储费/汇率，
// 故总价增加恰为 1200 / 汇率（外币）。
const PURE = {
  ...DEFAULTS, profitRate: 0, insuranceRate: 0, markupRate: 0,
  tariffRate: 0, importVatRate: 0, destinationFee: 0,
}
const dForeign = 1200 / DEFAULTS.exchangeRate // ≈169.0141 外币
for (const t of INCOTERMS) {
  const a = calcTermQuote({ ...PURE, tradeTerm: t.code, warehouseFee: 0 })
  const b = calcTermQuote({ ...PURE, tradeTerm: t.code, warehouseFee: 1200 })
  if (t.code === 'EXW') {
    close('EXW 仓储费 1200 → 总价不变', b.totalPrice, a.totalPrice, 1e-9)
    close('EXW 仓储费 1200 → 成本基准不变', b.costBase, a.costBase, 1e-9)
  } else {
    close(`${t.code} 仓储费 1200 → 总价增加 1200/汇率`, b.totalPrice - a.totalPrice, dForeign, 1e-6)
    close(`${t.code} 仓储费 1200 → 成本基准增加 1200 ¥`, b.costBase - a.costBase, 1200, 1e-9)
  }
}
// 默认参数下（含利润率与保险放大）：EXW 不变，所有非 EXW 术语总价增加
for (const t of INCOTERMS) {
  const a = calcTermQuote({ ...DEFAULTS, tradeTerm: t.code, warehouseFee: 0 })
  const b = calcTermQuote({ ...DEFAULTS, tradeTerm: t.code, warehouseFee: 1200 })
  if (t.code === 'EXW') {
    ok('默认参数 EXW 仓储费不影响总价', Math.abs(b.totalPrice - a.totalPrice) < 1e-9, `Δ=${b.totalPrice - a.totalPrice}`)
  } else {
    gt(`默认参数 ${t.code} 仓储费计入 → 总价增加`, b.totalPrice, a.totalPrice)
  }
}

console.log(`\n===== 汇总：PASS=${pass}  FAIL=${fail} =====`)
process.exit(fail === 0 ? 0 : 1)
