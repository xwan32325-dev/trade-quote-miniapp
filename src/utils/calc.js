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
 * innerLength/Width/Height：内尺寸 cm（用于几何码放计算）
 * innerVolume：内容积 CBM；usableVolume：实际可用 CBM；maxWeight：限重 kg
 * 默认柜型仍为 20GP；老记忆里的柜型代码继续有效。
 */
export const CONTAINERS = {
  '20GP': { label: '20GP', innerLength: 589, innerWidth: 234, innerHeight: 238, innerVolume: 33.2, usableVolume: 28, maxWeight: 17500 },
  '40GP': { label: '40GP', innerLength: 1203, innerWidth: 234, innerHeight: 238, innerVolume: 67.7, usableVolume: 58, maxWeight: 22000 },
  '40HQ': { label: '40HQ', innerLength: 1203, innerWidth: 234, innerHeight: 269, innerVolume: 76.4, usableVolume: 68, maxWeight: 22000 },
  '45HQ': { label: '45HQ', innerLength: 1355, innerWidth: 234, innerHeight: 269, innerVolume: 86.0, usableVolume: 76, maxWeight: 25000 },
  '20RF': { label: '20RF 冷藏', innerLength: 544, innerWidth: 229, innerHeight: 226, innerVolume: 28.3, usableVolume: 24, maxWeight: 20000 },
  '40RF': { label: '40RF 冷藏', innerLength: 1155, innerWidth: 229, innerHeight: 253, innerVolume: 67.0, usableVolume: 58, maxWeight: 26000 },
  '20OT': { label: '20OT 开顶', innerLength: 589, innerWidth: 234, innerHeight: 231, innerVolume: 32.0, usableVolume: 27, maxWeight: 21000 },
  '40OT': { label: '40OT 开顶', innerLength: 1203, innerWidth: 234, innerHeight: 231, innerVolume: 65.0, usableVolume: 56, maxWeight: 26000 },
};

/**
 * 几何码放：把箱子 (l×w×h) 放入柜内 (L×W×H)，枚举箱子 3 个维度的 6 种摆放排列，
 * 每种算 floor(L/a) × floor(W/b) × floor(H/c)，取最大值（不混排，只看整体最优摆放）。
 * 任一边为 0 / 非法时返回全 0，绝不出现 NaN。
 * @returns {{x:number, y:number, z:number, boxes:number}} 最优摆法各方向数量与总箱数
 */
export function bestPacking(container = {}, box = {}) {
  const L = safeNumber(container.length);
  const W = safeNumber(container.width);
  const H = safeNumber(container.height);
  const l = safeNumber(box.length);
  const w = safeNumber(box.width);
  const h = safeNumber(box.height);
  if (L <= 0 || W <= 0 || H <= 0 || l <= 0 || w <= 0 || h <= 0) {
    return { x: 0, y: 0, z: 0, boxes: 0 };
  }
  // 6 种排列：谁做「长/宽/高」都可以，逐个试
  const perms = [
    [l, w, h],
    [l, h, w],
    [w, l, h],
    [w, h, l],
    [h, l, w],
    [h, w, l],
  ];
  let best = { x: 0, y: 0, z: 0, boxes: 0 };
  for (let i = 0; i < perms.length; i++) {
    const a = perms[i][0];
    const b = perms[i][1];
    const c = perms[i][2];
    const x = Math.floor(L / a);
    const y = Math.floor(W / b);
    const z = Math.floor(H / c);
    const boxes = x * y * z;
    if (boxes > best.boxes) best = { x, y, z, boxes };
  }
  return best;
}

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
  // 几何码放可装箱数 = 6 种摆法里最优的那种（受柜内尺寸与箱子尺寸约束）
  const pack = bestPacking(
    { length: container.innerLength, width: container.innerWidth, height: container.innerHeight },
    { length, width, height },
  );
  const packBoxes = pack.boxes;
  // 可装箱数 = min(体积可装, 码放可装, 重量可装) —— 三者取小，最保守也最合理
  const boxes = Math.min(volumeBoxes, packBoxes, weightBoxes);
  // 总方数 = 可装箱数 × 单箱体积
  const totalVolume = boxes * boxVolume;
  // 总毛重 = 可装箱数 × 单箱毛重
  const totalWeight = boxes * grossWeight;
  // 容积利用率% = 总方数 / 实际可用 CBM × 100
  const utilization = safeDiv(totalVolume, container.usableVolume) * 100;

  // 受哪个因素限制：三者里最小的那个（同样小时按 体积 → 码放 → 重量 的次序）
  let limitBy = null;
  if (boxes > 0) {
    limitBy = 'volume';
    let min = volumeBoxes;
    if (packBoxes < min) {
      min = packBoxes;
      limitBy = 'packing';
    }
    if (weightBoxes < min) {
      min = weightBoxes;
      limitBy = 'weight';
    }
  }

  return sanitize({
    containerType,
    containerLabel: container.label,
    usableVolume: container.usableVolume,
    innerVolume: container.innerVolume,
    maxWeight: container.maxWeight,
    innerLength: container.innerLength,
    innerWidth: container.innerWidth,
    innerHeight: container.innerHeight,
    loadRate,
    boxVolume,
    grossWeight,
    volumeBoxes,
    packBoxes,
    packLayout: { x: pack.x, y: pack.y, z: pack.z },
    weightBoxes,
    boxes,
    totalVolume,
    totalWeight,
    utilization,
    limitBy, // 'volume' | 'packing' | 'weight' | null
  });
}

/**
 * 由「货量」三要素推导总箱数：
 * 填了总箱数 → 以它为准；否则填了总件数 + 每箱件数 → ceil(总件数 ÷ 每箱件数)；都缺 → 0。
 * 0 表示「不做多柜计算」。
 */
export function deriveTotalBoxes(input = {}) {
  const totalBoxes = Math.floor(safeNumber(input.totalBoxes));
  if (totalBoxes > 0) return totalBoxes;
  const totalQty = safeNumber(input.totalQty);
  const perBoxQty = safeNumber(input.perBoxQty);
  if (totalQty > 0 && perBoxQty > 0) return Math.ceil(totalQty / perBoxQty);
  return 0;
}

/**
 * 多柜分配：前面每柜装满 perBoxes 箱，最后一柜装剩余；剩余正好为 0 时不额外空柜。
 * @returns {{count:number, list:number[]}} count=需要柜数，list=每柜箱数（末柜可能不满）
 */
export function planContainers(totalBoxes, perBoxes) {
  const n = Math.floor(safeNumber(totalBoxes));
  const cap = Math.floor(safeNumber(perBoxes));
  if (n <= 0 || cap <= 0) return { count: 0, list: [] };
  const list = [];
  let remain = n;
  while (remain > 0) {
    const take = Math.min(cap, remain);
    list.push(take);
    remain -= take;
  }
  return { count: list.length, list };
}

/**
 * 柜型对比：对每种柜型算「装完 totalBoxes 需要几个柜」，按「柜数升序 → 柜型从小到大（内容积）」排列。
 * 装不下的柜型（可装 0 箱）排最后。用于回答「用哪个柜划算」。
 */
export function compareContainers(boxSpec = {}, totalBoxes = 0) {
  const rows = Object.keys(CONTAINERS).map((type) => {
    const r = calcLoading({ ...boxSpec, containerType: type });
    const perBoxes = r.boxes;
    const count = perBoxes > 0 && totalBoxes > 0 ? Math.ceil(totalBoxes / perBoxes) : 0;
    return {
      type,
      label: CONTAINERS[type].label,
      innerVolume: CONTAINERS[type].innerVolume,
      perBoxes,
      count,
    };
  });
  rows.sort((a, b) => {
    const ca = a.count > 0 ? a.count : Infinity;
    const cb = b.count > 0 ? b.count : Infinity;
    if (ca !== cb) return ca - cb;
    return a.innerVolume - b.innerVolume;
  });
  return rows;
}
