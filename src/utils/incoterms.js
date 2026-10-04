/**
 * incoterms.js — Incoterms 2020 十一种贸易术语：术语表、按术语计算、按运输方式过滤与切换映射
 * 纯数据 + 纯函数，无 uni / DOM 依赖，可在 Node 中直接单测。
 * 计算口径严格按 TASK-INCOTERMS.md 第二节，勿自行改动。
 */
import { safeNumber } from './calc.js'
import { isSeaMode } from './transport.js'

// 仅海运类（含内河）可选的 4 种术语；空运/快递/铁路等不能报 FOB/CFR/CIF
const SEA_ONLY = ['FAS', 'FOB', 'CFR', 'CIF']

export const INCOTERMS = [
  { code: 'EXW', name: 'Ex Works', zh: '工厂交货' },
  { code: 'FAS', name: 'Free Alongside Ship', zh: '船边交货' },
  { code: 'FOB', name: 'Free on Board', zh: '船上交货' },
  { code: 'CFR', name: 'Cost and Freight', zh: '成本加运费' },
  { code: 'CIF', name: 'Cost, Insurance and Freight', zh: '成本、保险费加运费' },
  { code: 'FCA', name: 'Free Carrier', zh: '货交承运人' },
  { code: 'CPT', name: 'Carriage Paid To', zh: '运费付至' },
  { code: 'CIP', name: 'Carriage and Insurance Paid To', zh: '运费加保险费付至' },
  { code: 'DAP', name: 'Delivered at Place', zh: '目的地交货' },
  { code: 'DPU', name: 'Delivered at Place Unloaded', zh: '卸货地交货' },
  { code: 'DDP', name: 'Delivered Duty Paid', zh: '完税后交货' },
]

// 各术语计入的费用项（页面据此决定明细行与「本术语不计入」标注）
// carriage=运费，insurance=保险费，destination=目的地费用，duty=关税+进口增值税
const INCLUDES = {
  EXW: { carriage: false, insurance: false, destination: false, duty: false },
  FAS: { carriage: false, insurance: false, destination: false, duty: false },
  FOB: { carriage: false, insurance: false, destination: false, duty: false },
  FCA: { carriage: false, insurance: false, destination: false, duty: false },
  CFR: { carriage: true, insurance: false, destination: false, duty: false },
  CPT: { carriage: true, insurance: false, destination: false, duty: false },
  CIF: { carriage: true, insurance: true, destination: false, duty: false },
  CIP: { carriage: true, insurance: true, destination: false, duty: false },
  DAP: { carriage: true, insurance: false, destination: true, duty: false },
  DPU: { carriage: true, insurance: false, destination: true, duty: false },
  DDP: { carriage: true, insurance: false, destination: true, duty: true },
}

// 海运类 ↔ 非海运：同一语义层级的术语成对映射（交接点/价格构成一致）
const UNIVERSAL_TO_SEA = { FCA: 'FOB', CPT: 'CFR', CIP: 'CIF' } // 非海运 → 海运
const SEA_TO_UNIVERSAL = { FAS: 'FCA', FOB: 'FCA', CFR: 'CPT', CIF: 'CIP' } // 海运 → 非海运

/** 安全除法：除数为 0 或结果非有限时返回 0，避免出现 NaN / Infinity */
function safeDivide(a, b) {
  if (!b) return 0
  const r = a / b
  return Number.isFinite(r) ? r : 0
}

/** 把结果对象里所有非有限数字压成 0，作为最后一道兜底 */
function sanitizeNumbers(obj) {
  const out = {}
  for (const key in obj) {
    const v = obj[key]
    out[key] = typeof v === 'number' && !Number.isFinite(v) ? 0 : v
  }
  return out
}

/** 按代码查术语，找不到返回 null */
export function getIncoterm(code) {
  const c = String(code || '').toUpperCase()
  return INCOTERMS.find((t) => t.code === c) || null
}

/** 「CIF（成本、保险费加运费）」形式；未知代码回退 FOB */
export function termLabel(code) {
  const t = getIncoterm(code) || getIncoterm('FOB')
  return `${t.code}（${t.zh}）`
}

/** 该术语计入哪些费用项；未知代码按 FOB 处理 */
export function termIncludes(code) {
  return INCLUDES[String(code || '').toUpperCase()] || INCLUDES.FOB
}

/** 当前运输方式可选的术语：海运类 11 种，其余 7 种（去掉 FAS/FOB/CFR/CIF） */
export function termsForMode(modeCode) {
  return isSeaMode(modeCode)
    ? INCOTERMS.slice()
    : INCOTERMS.filter((t) => SEA_ONLY.indexOf(t.code) === -1)
}

/** 术语是否适用于该运输方式 */
export function isValidTerm(code, modeCode) {
  const c = String(code || '').toUpperCase()
  return termsForMode(modeCode).some((t) => t.code === c)
}

/** 该运输方式的默认术语：海运 FOB，其余 FCA */
export function defaultTerm(modeCode) {
  return isSeaMode(modeCode) ? 'FOB' : 'FCA'
}

/**
 * 切换运输方式时的术语映射：按语义层级成对搬运，非法结果回退目标方式默认值
 * 例：FOB↔FCA、CFR↔CPT、CIF↔CIP、FAS→FCA、EXW/DAP/DPU/DDP 保持
 */
export function remapTerm(term, fromMode, toMode) {
  const fromSea = isSeaMode(fromMode)
  const toSea = isSeaMode(toMode)
  let mapped = String(term || '').toUpperCase()
  if (fromSea !== toSea) {
    const table = toSea ? UNIVERSAL_TO_SEA : SEA_TO_UNIVERSAL
    mapped = table[mapped] || mapped
  }
  return isValidTerm(mapped, toMode) ? mapped : defaultTerm(toMode)
}

/**
 * 按贸易术语计算报价（口径见 TASK-INCOTERMS.md 第二节）
 * @param {object} input 见下；缺省字段按 0 处理，tradeTerm 默认 FOB
 * @returns 该术语下的金额与指标，以及换汇成本/盈亏率（固定 FOB 口径）
 */
export function calcTermQuote(input = {}) {
  const price = safeNumber(input.price) // 采购含税价 ¥/件
  const qty = safeNumber(input.qty) // 数量
  const vatRate = safeNumber(input.vatRate) // 增值税率 %
  const rebateRate = safeNumber(input.rebateRate) // 退税率 %
  const domesticFee = safeNumber(input.domesticFee) // 国内费用合计 ¥ 整票（由页面把 7 项明细累加后传入）
  const exchangeRate = safeNumber(input.exchangeRate) // 汇率 1 外币 = ? ¥
  const profitRate = safeNumber(input.profitRate) // 利润率 %
  const freight = safeNumber(input.freight) // 运费 外币整票
  const insuranceRate = safeNumber(input.insuranceRate) // 保险费率 %
  const markupRate = safeNumber(input.markupRate) // 投保加成 %
  const destinationFee = safeNumber(input.destinationFee) // 目的地费用 外币整票
  const tariffRate = safeNumber(input.tariffRate) // 进口关税税率 %
  const importVatRate = safeNumber(input.importVatRate) // 目的国增值税率 %

  const term = String(input.tradeTerm || input.term || 'FOB').toUpperCase()
  const inc = termIncludes(term)

  // 退税额/件 = 采购含税价 / (1 + 增值税率/100) × (退税率/100)
  const refundPerUnit = safeDivide(price, 1 + vatRate / 100) * (rebateRate / 100)
  const refundTotal = refundPerUnit * qty
  // 货值成本¥ = (采购含税价 - 退税额/件) × 数量      ← EXW 基数
  const goodsValue = (price - refundPerUnit) * qty
  // 含国内成本¥ = 货值成本¥ + 国内费用合计            ← 其余术语基数（EXW 不含）
  const withDomestic = goodsValue + domesticFee
  // 基准价$：EXW 用货值成本，其余用含国内成本
  const costBase = term === 'EXW' ? goodsValue : withDomestic
  const basePrice = safeDivide(costBase, exchangeRate) * (1 + profitRate / 100)

  // 运费$、保险费基数$、保险费$、CIF 口径到岸价$
  const insuranceBase = safeDivide(
    basePrice + freight,
    1 - (insuranceRate / 100) * (1 + markupRate / 100),
  )
  const insurance = insuranceBase * (insuranceRate / 100) * (1 + markupRate / 100)
  const cifArrival = basePrice + freight + insurance

  // 关税$ 与目的国进口增值税$（均以 CIF 口径到岸价为基础）
  const tariff = cifArrival * (tariffRate / 100)
  const importVat = (cifArrival + tariff) * (importVatRate / 100)

  // 按术语汇总总价$（FAS/FOB/FCA/EXW 为基准价；FAS 与 FOB 共用基准，装船费不单列）
  let totalPrice = basePrice
  if (term === 'CFR' || term === 'CPT') totalPrice = basePrice + freight
  else if (term === 'CIF' || term === 'CIP') totalPrice = cifArrival
  else if (term === 'DAP' || term === 'DPU') totalPrice = basePrice + freight + destinationFee
  else if (term === 'DDP') totalPrice = basePrice + freight + destinationFee + tariff + importVat
  const unitPrice = safeDivide(totalPrice, qty)

  // 换汇成本 / 盈亏率固定按 FOB（含国内成本）口径，与所选术语无关
  const fobBasePrice = safeDivide(withDomestic, exchangeRate) * (1 + profitRate / 100)
  const exchangeCost = safeDivide(withDomestic, fobBasePrice)
  const profitPct = safeDivide(fobBasePrice * exchangeRate - withDomestic, withDomestic) * 100

  const result = {
    tradeTerm: term,
    price, qty, vatRate, rebateRate, domesticFee, exchangeRate,
    profitRate, freight, insuranceRate, markupRate,
    destinationFee, tariffRate, importVatRate,
    refundPerUnit, refundTotal, goodsValue, withDomestic, costBase,
    basePrice, insurance, cifArrival, tariff, importVat,
    totalPrice, unitPrice,
    exchangeCost, profitPct,
    includesFreight: inc.carriage,
    includesInsurance: inc.insurance,
    includesDestination: inc.destination,
    includesDuty: inc.duty,
    // EXW 不含国内费用合计，其余术语都含
    includesDomestic: term !== 'EXW',
  }
  const out = sanitizeNumbers(result)
  // 换汇成本低于汇率 → 盈利；高于汇率 → 亏损（无有效成本时两者都不标）
  out.isProfit = out.exchangeCost > 0 && out.exchangeCost < out.exchangeRate
  out.isLoss = out.exchangeCost > 0 && out.exchangeCost > out.exchangeRate
  return out
}

/**
 * 手动定价反算（口径见 TASK-MANUALPRICE.md 第二节）
 * 手填单价 U 后：先求成本基准（利润率置 0 的 calcTermQuote 单价 U0$）得 C$ = U0$ × Q，
 * 再反算利润额与成本加成率；最后按术语扣掉相对 FOB 的附加费用得到 FOB 净收入，
 * 算换汇成本与盈亏率。不改动 calcTermQuote，只额外以「利润率置 0」调用一次。
 * @param {object} input 与 calcTermQuote 相同（含 tradeTerm / qty / exchangeRate / domesticFee 等，domesticFee 为 7 项明细合计）
 * @param {number|string} manualUnitPrice 手动单价 U（外币/件）
 * @returns 反算指标；所有数值字段保证有限（无 NaN / Infinity）
 */
export function calcManualTermQuote(input = {}, manualUnitPrice) {
  const qty = safeNumber(input.qty)
  const exchangeRate = safeNumber(input.exchangeRate)
  const insuranceRate = safeNumber(input.insuranceRate)
  const markupRate = safeNumber(input.markupRate)
  const domesticFee = safeNumber(input.domesticFee)
  const term = String(input.tradeTerm || input.term || 'FOB').toUpperCase()

  // 成本基准：利润率临时置 0，同口径算出该术语单价 U0$ 与总价 C$
  const cost = calcTermQuote({ ...input, profitRate: 0 })
  const costTotal = cost.unitPrice * qty

  // 手动总价 T$、利润额与成本加成率（C$ 为 0 时返回 0）
  const manualUnit = safeNumber(manualUnitPrice)
  const manualTotal = manualUnit * qty
  const profitAmount = manualTotal - costTotal
  const markupPct = safeDivide(profitAmount, costTotal) * 100

  // 保险费仍按现有公式，基数换成手动总价：保险$ = T$ × I/100 × (1+M/100)
  const insurance = manualTotal * (insuranceRate / 100) * (1 + markupRate / 100)

  // 该术语相对 FOB 多出来的附加费用（EXW 为负：不含国内费用合计，倒推 FOB 要加回）
  let extra = 0
  if (term === 'CFR' || term === 'CPT') extra = cost.freight
  else if (term === 'CIF' || term === 'CIP') extra = cost.freight + insurance
  else if (term === 'DAP' || term === 'DPU') extra = cost.freight + cost.destinationFee
  else if (term === 'DDP') extra = cost.freight + cost.destinationFee + cost.tariff + cost.importVat
  else if (term === 'EXW') extra = -safeDivide(domesticFee, exchangeRate)
  // FAS / FOB / FCA → 0

  const fobNet = manualTotal - extra
  const exportCost = cost.withDomestic // 出口总成本¥（含国内费用，与利润率无关）
  const exchangeCost = safeDivide(exportCost, fobNet)
  const profitPct = safeDivide(fobNet * exchangeRate - exportCost, exportCost) * 100

  const out = sanitizeNumbers({
    tradeTerm: term,
    exchangeRate,
    manualUnit, manualTotal,
    costUnit: cost.unitPrice, costTotal,
    profitAmount, markupPct,
    insurance, extra, fobNet,
    exportCost, exchangeCost, profitPct,
    // 费用明细沿用成本基准（利润率置 0）口径，展示与 FOB 净收入扣减保持一致
    freight: cost.freight,
    destinationFee: cost.destinationFee,
    tariff: cost.tariff,
    importVat: cost.importVat,
    belowCost: profitAmount < 0,
    shortfall: profitAmount < 0 ? -profitAmount : 0,
  })
  // 换汇成本以汇率对照盈亏，与 calcTermQuote 同口径
  out.isProfit = out.exchangeCost > 0 && out.exchangeCost < exchangeRate
  out.isLoss = out.exchangeCost > 0 && out.exchangeCost > exchangeRate
  return out
}
