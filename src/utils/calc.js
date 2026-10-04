/**
 * calc.js — 报价计算与装柜计算的纯函数集合
 * 无任何 uni / DOM 依赖，可脱离小程序环境在 Node 中直接单测。
 * 所有公式严格按 SPEC.md，未做任何口径改动。
 */

/** 把任意输入转成有限数字；空值/非法值用兜底值（默认 0） */
export function safeNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 安全除法：除数为 0 或结果非有限时返回 0，避免出现 NaN / Infinity */
function safeDiv(a, b) {
  if (!b) return 0;
  const r = a / b;
  return Number.isFinite(r) ? r : 0;
}

/** 把结果对象里所有非有限数字（NaN / Infinity）压成 0，作为最后一道兜底 */
function sanitize(obj) {
  const out = {};
  for (const key in obj) {
    const v = obj[key];
    out[key] = typeof v === 'number' && !Number.isFinite(v) ? 0 : v;
  }
  return out;
}

/**
 * 报价计算
 * @param {object} input 见下方字段说明；缺省字段按 0 处理
 * @returns 报价口径的全部金额与指标（原始精度，展示时再格式化）
 */
export function calcQuote(input = {}) {
  const price = safeNumber(input.price); // 采购成本（含税，¥/件）
  const qty = safeNumber(input.qty); // 数量（件）
  const vatRate = safeNumber(input.vatRate); // 增值税率 %
  const rebateRate = safeNumber(input.rebateRate); // 出口退税率 %
  const domesticFee = safeNumber(input.domesticFee); // 国内费用合计 ¥
  const exchangeRate = safeNumber(input.exchangeRate); // 汇率 1 USD = ? ¥
  const profitRate = safeNumber(input.profitRate); // 预期利润率 %
  const freight = safeNumber(input.freight); // 海运费 $
  const insuranceRate = safeNumber(input.insuranceRate); // 保险费率 %
  const markupRate = safeNumber(input.markupRate); // 投保加成率 %

  // 退税额/件 = 采购含税价 / (1 + 增值税率/100) × (退税率/100)
  const refundPerUnit = safeDiv(price, 1 + vatRate / 100) * (rebateRate / 100);
  // 退税额合计 = 退税额/件 × 数量
  const refundTotal = refundPerUnit * qty;
  // 出口总成本¥ = 采购含税价 × 数量 - 退税额/件 × 数量 + 国内费用
  const totalCost = price * qty - refundPerUnit * qty + domesticFee;
  // FOB 总价$ = 出口总成本¥ / 汇率 × (1 + 利润率/100)
  const fobTotal = safeDiv(totalCost, exchangeRate) * (1 + profitRate / 100);
  // FOB 单价$ = FOB 总价$ / 数量
  const fobUnit = safeDiv(fobTotal, qty);
  // CFR 总价$ = FOB 总价$ + 海运费
  const cfrTotal = fobTotal + freight;
  // CIF 总价$ = (FOB 总价$ + 海运费) / (1 - 保险费率/100 × (1 + 投保加成率/100))
  const cifDenom = 1 - (insuranceRate / 100) * (1 + markupRate / 100);
  const cifTotal = safeDiv(cfrTotal, cifDenom);
  // 保险费$ = CIF 总价$ × 保险费率/100 × (1 + 投保加成率/100)
  const insurance = cifTotal * (insuranceRate / 100) * (1 + markupRate / 100);
  // 换汇成本 = 出口总成本¥ / FOB 总价$（低于汇率=盈利）
  const exchangeCost = safeDiv(totalCost, fobTotal);
  // 盈亏率% = (FOB 总价$ × 汇率 - 出口总成本¥) / 出口总成本¥ × 100
  const profitPct = safeDiv(fobTotal * exchangeRate - totalCost, totalCost) * 100;

  const result = {
    price, qty, vatRate, rebateRate, domesticFee, exchangeRate,
    profitRate, freight, insuranceRate, markupRate,
    refundPerUnit, refundTotal, totalCost,
    fobTotal, fobUnit, cfrTotal, cifTotal, insurance,
    exchangeCost, profitPct,
  };
  // 换汇成本低于汇率 → 盈利；高于汇率 → 亏损（无有效成本时两者都不标）
  result.isProfit = exchangeCost > 0 && exchangeCost < exchangeRate;
  result.isLoss = exchangeCost > 0 && exchangeCost > exchangeRate;
  return sanitize(result);
}

/**
 * 柜型参数（常见行业参考值，不同船公司略有差异，仅用于估算）
 * innerVolume：内容积 CBM；usableVolume：实际可用 CBM；maxWeight：限重 kg
 */
export const CONTAINERS = {
  '20GP': { label: '20GP', innerVolume: 33.2, usableVolume: 28, maxWeight: 17500 },
  '40GP': { label: '40GP', innerVolume: 67.7, usableVolume: 58, maxWeight: 22000 },
  '40HQ': { label: '40HQ', innerVolume: 76.4, usableVolume: 68, maxWeight: 22000 },
};

/**
 * 数字格式化：固定小数位 + 千分位（不依赖 Intl，小程序 / H5 通用）
 * @param {*} value 原始值
 * @param {number} decimals 小数位，金额默认 2
 */
export function formatNumber(value, decimals = 2) {
  const n = safeNumber(value);
  const fixed = n.toFixed(decimals);
  const negative = fixed.charAt(0) === '-';
  const body = negative ? fixed.slice(1) : fixed;
  const dot = body.indexOf('.');
  const intPart = dot === -1 ? body : body.slice(0, dot);
  const decPart = dot === -1 ? '' : body.slice(dot); // 含小数点
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + withSep + decPart;
}

/** 装柜计算 */
export function calcLoading(input = {}) {
  const length = safeNumber(input.length); // 单箱长 cm
  const width = safeNumber(input.width); // 单箱宽 cm
  const height = safeNumber(input.height); // 单箱高 cm
  const grossWeight = safeNumber(input.grossWeight); // 单箱毛重 kg
  const loadRate = input.loadRate === '' || input.loadRate === null || input.loadRate === undefined
    ? 85
    : safeNumber(input.loadRate); // 装载率 %，默认 85
  const containerType = input.containerType || '20GP';
  const container = CONTAINERS[containerType] || CONTAINERS['20GP'];

  // 单箱体积 CBM = 长 × 宽 × 高 / 1,000,000
  const boxVolume = (length * width * height) / 1000000;
  // 体积可装箱数 = floor(实际可用 CBM × 装载率/100 / 单箱体积)
  const volumeBoxes = boxVolume > 0
    ? Math.floor((container.usableVolume * (loadRate / 100)) / boxVolume)
    : 0;
  // 重量可装箱数 = floor(限重 / 单箱毛重)
  const weightBoxes = grossWeight > 0 ? Math.floor(container.maxWeight / grossWeight) : 0;
  // 可装箱数 = min(体积可装箱数, 重量可装箱数)
  const boxes = Math.min(volumeBoxes, weightBoxes);
  // 总方数 = 可装箱数 × 单箱体积
  const totalVolume = boxes * boxVolume;
  // 总毛重 = 可装箱数 × 单箱毛重
  const totalWeight = boxes * grossWeight;
  // 容积利用率% = 总方数 / 实际可用 CBM × 100
  const utilization = safeDiv(totalVolume, container.usableVolume) * 100;

  // 受体积限制还是受重量限制（两者都装不满时取更小的一方）
  let limitBy = null;
  if (boxes > 0) limitBy = volumeBoxes <= weightBoxes ? 'volume' : 'weight';

  return sanitize({
    containerType,
    containerLabel: container.label,
    usableVolume: container.usableVolume,
    innerVolume: container.innerVolume,
    maxWeight: container.maxWeight,
    loadRate,
    boxVolume,
    volumeBoxes,
    weightBoxes,
    boxes,
    totalVolume,
    totalWeight,
    utilization,
    limitBy, // 'volume' | 'weight' | null
  });
}
