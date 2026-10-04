/**
 * currency.js — 结算币种表与展示辅助
 * 与后端 /api/fx 支持的币种保持一致，纯数据 + 纯函数，无任何 uni / DOM 依赖。
 */

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: '美元' },
  { code: 'EUR', symbol: '€', name: '欧元' },
  { code: 'JPY', symbol: 'JP¥', name: '日元' }, // 用 JP¥ 避免和人民币 ¥ 混淆
  { code: 'GBP', symbol: '£', name: '英镑' },
  { code: 'AUD', symbol: 'A$', name: '澳元' },
  { code: 'HKD', symbol: 'HK$', name: '港币' },
  { code: 'CAD', symbol: 'C$', name: '加元' },
  { code: 'SGD', symbol: 'S$', name: '新加坡元' },
  { code: 'KRW', symbol: '₩', name: '韩元' },
  { code: 'THB', symbol: '฿', name: '泰铢' },
  { code: 'VND', symbol: '₫', name: '越南盾' },
  { code: 'MYR', symbol: 'RM', name: '马来西亚林吉特' },
  { code: 'IDR', symbol: 'Rp', name: '印尼盾' },
  { code: 'PHP', symbol: '₱', name: '菲律宾比索' },
  { code: 'INR', symbol: '₹', name: '印度卢比' },
  { code: 'RUB', symbol: '₽', name: '卢布' },
  { code: 'AED', symbol: 'AED', name: '迪拉姆' },
  { code: 'MXN', symbol: 'MX$', name: '墨西哥比索' },
  { code: 'BRL', symbol: 'R$', name: '雷亚尔' },
  { code: 'ZAR', symbol: 'R', name: '南非兰特' },
  { code: 'TRY', symbol: '₺', name: '土耳其里拉' },
  { code: 'CHF', symbol: 'CHF', name: '瑞士法郎' },
  { code: 'NZD', symbol: 'NZ$', name: '新西兰元' },
  { code: 'PLN', symbol: 'zł', name: '波兰兹罗提' },
  { code: 'SEK', symbol: 'kr', name: '瑞典克朗' },
]

const DEFAULT_CURRENCY = CURRENCIES[0]

/** 按代码查币种项，找不到（含空值/历史记录缺字段）回退 USD */
export function getCurrency(code) {
  const c = String(code || '').toUpperCase()
  return CURRENCIES.find((item) => item.code === c) || DEFAULT_CURRENCY
}

/** 汇率显示位数：小面值币种必须多给几位，否则会显示成 0.0000 */
export function rateDecimals(rate) {
  const n = Number(rate)
  if (!Number.isFinite(n) || n <= 0) return 4
  if (n >= 1) return 4
  if (n >= 0.01) return 5
  if (n >= 0.001) return 6
  if (n >= 0.0001) return 7
  return 8
}
