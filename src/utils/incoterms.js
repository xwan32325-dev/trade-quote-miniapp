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

/** 取一行明细的采购含税价（兼容 price / unitPrice 两种字段名） */
function itemPrice(it) {
  if (!it) return 0
  return safeNumber(it.price !== undefined && it.price !== null ? it.price : it.unitPrice)
}

/** 总数量：多产品明细取各行数量之和，否则取扁平 qty */
function totalQty(input) {
  const items = input && input.items
  if (Array.isArray(items) && items.length) {
    return items.reduce((sum, it) => sum + safeNumber(it && it.qty), 0)
  }
  return safeNumber(input && input.qty)
}

/** 单行退税额/件 = 采购含税价 ÷ (1 + 该行增值税率/100) × 该行退税率/100 */
function itemRefundPerUnit(it) {
  const vatRate = safeNumber(it && it.vatRate)
  const rebateRate = safeNumber(it && it.rebateRate)
  return safeDivide(itemPrice(it), 1 + vatRate / 100) * (rebateRate / 100)
}

/** 单行货值¥ = (采购含税价 − 退税额/件) × 该行数量 */
function itemGoodsValue(it) {
  return (itemPrice(it) - itemRefundPerUnit(it)) * safeNumber(it && it.qty)
}

/** 保留 n 位小数（-0 归一为 0） */
function roundN(v, n) {
  const f = Math.pow(10, n)
  const r = Math.round(safeNumber(v) * f) / f
  return r === 0 ? 0 : r
}

/** 保留 2 位小数 */
function round2(v) {
  return roundN(v, 2)
}

// 单价最大位数：2 位不够时最多给到 6 位（低价大批量常见 4 位，如 USD 0.4734）
const MAX_PRICE_DECIMALS = 6
// 2 位小数的相对容差：分摊额的 0.1%（2 位四舍五入的常规报价偏差，多数向上取整，对卖方有利）
const PRICE_REL_TOLERANCE = 0.001

/**
 * 选单价位数 d∈[2,6]：
 *   先试 2 位——|round(分摊额 ÷ 数量, 2) × 数量 − 分摊额| ≤ max(0.01, 分摊额 × 0.1%) 则用 2 位
 *     （常规外贸报价单价写 2 位，±0.1% 内偏差属正常，不必为凑准升位）
 *   否则 d 从 3 递增到 6，取首个满足 |round(分摊额 ÷ 数量, d) × 数量 − 分摊额| ≤ 0.01 的 d
 *   2~6 位都不满足则取 6
 */
function pickUnitDecimals(amount, qty) {
  const tol2 = Math.max(0.01, Math.abs(safeNumber(amount)) * PRICE_REL_TOLERANCE)
  const u2 = roundN(safeDivide(amount, qty), 2)
  if (Math.abs(round2(u2 * qty) - safeNumber(amount)) <= tol2) return 2
  for (let d = 3; d <= MAX_PRICE_DECIMALS; d++) {
    if (Math.abs(roundN(safeDivide(amount, qty), d) * qty - amount) <= 0.01) return d
  }
  return MAX_PRICE_DECIMALS
}

/**
 * 由行金额反求单价：取最小位数 d∈[2,6] 使 round(单价 × 数量, 2) === 金额（收尾兜底用）
 * 数量为 0 → 单价 0；6 位内凑不准时取 6 位（尽力而为）
 */
function unitPriceForAmount(amount, qty) {
  if (!qty) return { unitPrice: 0, decimals: 2 }
  for (let d = 2; d <= MAX_PRICE_DECIMALS; d++) {
    const u = roundN(safeDivide(amount, qty), d)
    if (round2(u * qty) === amount) return { unitPrice: u, decimals: d }
  }
  return { unitPrice: roundN(safeDivide(amount, qty), MAX_PRICE_DECIMALS), decimals: MAX_PRICE_DECIMALS }
}

/**
 * 按货值占比把整单总价分摊到各行（口径见 TASK-DECIMALS.md / TASK-PRICE2.md）
 *   分摊额 = 整单总价 × 行货值占比（整单货值为 0 时占比为 0，全行金额为 0）
 *   位数 d 由 pickUnitDecimals 选（先试 2 位，偏差超 0.1% 才升位到 3~6）
 *   行单价 = round(分摊额 ÷ 数量, d)；行金额 = round(行单价 × 数量, 2)
 * 收尾：
 *   手动模式（manual=true）：把 round(整单总价 − Σ 行金额, 2) 的差额补到【最后一行】，
 *                             使 Σ 行金额 严格等于用户手填的整单总价
 *   自动模式（manual=false）：不做兜底——整单总价以 Σ 行金额 为准（避免把最后一行单价搞成怪数）
 * @param {Array<{productName?:string, qty:number, price?:number, unitPrice?:number, vatRate?:number, rebateRate?:number}>} items
 * @param {number|string} totalPrice 整单总价（外币；手动定价时为用户手填值）
 * @param {boolean} [manual=false] 是否手动定价模式（true 时保留最后一行兜底）
 * @returns {Array<{productName:string, qty:number, unitPrice:number, totalPrice:number, decimals:number}>}
 */
export function allocateItems(items, totalPrice, manual = false) {
  const list = Array.isArray(items) ? items : []
  const goods = list.map(itemGoodsValue)
  const goodsTotal = goods.reduce((sum, v) => sum + v, 0)
  const total = round2(totalPrice)

  // 整单货值为 0：各行占比一律为 0 → 单价/金额全为 0（不做收尾兜底，避免把总价堆到某行）
  if (!(goodsTotal > 0)) {
    return list.map((it) => ({
      productName: it && it.productName ? String(it.productName) : '',
      qty: safeNumber(it && it.qty),
      unitPrice: 0,
      totalPrice: 0,
      decimals: 2,
    }))
  }

  const rows = list.map((it, i) => {
    const qty = safeNumber(it && it.qty)
    const productName = it && it.productName ? String(it.productName) : ''
    const amount = total * (goods[i] / goodsTotal)
    if (!qty) return { productName, qty, unitPrice: 0, totalPrice: 0, decimals: 2 }
    const decimals = pickUnitDecimals(amount, qty)
    const unitPrice = roundN(safeDivide(amount, qty), decimals)
    return { productName, qty, unitPrice, totalPrice: round2(unitPrice * qty), decimals }
  })

  // 收尾兜底：仅手动模式保留（自动模式的整单总价 = Σ 行金额，不调整任何一行）
  const lastRow = rows[rows.length - 1]
  if (manual && lastRow) {
    const diff = round2(total - rows.reduce((s, r) => s + r.totalPrice, 0))
    if (Math.abs(diff) > 0.001) {
      const newTotal = round2(lastRow.totalPrice + diff)
      const { unitPrice, decimals } = unitPriceForAmount(newTotal, lastRow.qty)
      lastRow.totalPrice = newTotal
      lastRow.unitPrice = unitPrice
      lastRow.decimals = decimals
    }
  }
  return rows
}

/**
 * Σ 行金额 = 整单总价（新口径：整单总价就是各行金额之和）
 * @param {Array<{totalPrice:number}>} rows allocateItems 的返回值
 */
export function sumItems(rows) {
  return round2((Array.isArray(rows) ? rows : []).reduce((sum, r) => sum + safeNumber(r && r.totalPrice), 0))
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
  const items = Array.isArray(input.items) && input.items.length ? input.items : null
  const price = safeNumber(input.price) // 采购含税价 ¥/件（单产品口径；兼容旧调用）
  const qty = totalQty(input) // 数量：多产品明细为各行数量之和
  const vatRate = safeNumber(input.vatRate) // 增值税率 %（单产品口径；兼容旧调用）
  const rebateRate = safeNumber(input.rebateRate) // 退税率 %（单产品口径；兼容旧调用）
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

  // 退税额与货值成本：多产品明细按各行自己的增值税率/退税率逐行计算再求和；
  // 单产品沿用扁平字段（结果与改动前逐字节一致）
  let refundPerUnit, refundTotal, goodsValue
  if (items) {
    // 逐行用「(采购含税价 − 该行退税额/件) × 数量」求和，与单产品公式同形，
    // 单行时结果与改动前逐字节一致
    refundTotal = items.reduce((sum, it) => sum + itemRefundPerUnit(it) * safeNumber(it.qty), 0)
    goodsValue = items.reduce((sum, it) => sum + itemGoodsValue(it), 0)
    refundPerUnit = safeDivide(refundTotal, qty)
  } else {
    // 退税额/件 = 采购含税价 / (1 + 增值税率/100) × (退税率/100)
    refundPerUnit = safeDivide(price, 1 + vatRate / 100) * (rebateRate / 100)
    refundTotal = refundPerUnit * qty
    // 货值成本¥ = (采购含税价 - 退税额/件) × 数量      ← EXW 基数
    goodsValue = (price - refundPerUnit) * qty
  }
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
 * @param {object} input 与 calcTermQuote 相同（含 tradeTerm / qty / exchangeRate / domesticFee 等，domesticFee 为 7 项明细合计；多产品时传 items）
 * @param {number|string} manualPrice 手动价：单产品为单价 U（外币/件），isTotal=true 时为整单总价 T（外币）
 * @param {boolean} [isTotal] true 表示 manualPrice 直接作为整单总价（由页面在明细多于 1 行时传入）
 * @returns 反算指标；所有数值字段保证有限（无 NaN / Infinity）
 */
export function calcManualTermQuote(input = {}, manualPrice, isTotal = false) {
  const qty = totalQty(input)
  const exchangeRate = safeNumber(input.exchangeRate)
  const insuranceRate = safeNumber(input.insuranceRate)
  const markupRate = safeNumber(input.markupRate)
  const domesticFee = safeNumber(input.domesticFee)
  const term = String(input.tradeTerm || input.term || 'FOB').toUpperCase()

  // 成本基准：利润率临时置 0，同口径算出该术语单价 U0$ 与总价 C$
  const cost = calcTermQuote({ ...input, profitRate: 0 })
  const costTotal = cost.unitPrice * qty

  // 手动总价 T$、利润额与成本加成率（C$ 为 0 时返回 0）
  // isTotal=true（多产品明细）：手填值即整单总价；否则按单价 × 数量
  const manualUnit = isTotal ? safeDivide(safeNumber(manualPrice), qty) : safeNumber(manualPrice)
  const manualTotal = isTotal ? safeNumber(manualPrice) : manualUnit * qty
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
