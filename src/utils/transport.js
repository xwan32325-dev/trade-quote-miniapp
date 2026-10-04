/**
 * transport.js — 运输方式表与展示辅助
 * 纯数据 + 纯函数，无 uni / DOM 依赖。
 * 海运类（含内河）用 FOB/CFR/CIF，其余按 Incoterms 用 FCA/CPT/CIP（计算口径相同）。
 */

export const TRANSPORT_MODES = [
  { code: 'SEA_FCL', name: '海运整柜（FCL）' },
  { code: 'SEA_LCL', name: '海运拼箱（LCL）' },
  { code: 'SEA_BULK', name: '海运散杂货' },
  { code: 'AIR', name: '空运' },
  { code: 'EXPRESS', name: '国际快递' },
  { code: 'POST', name: '国际邮政小包' },
  { code: 'RAIL', name: '铁路运输（中欧班列）' },
  { code: 'ROAD', name: '公路运输（跨境卡航）' },
  { code: 'INLAND', name: '内河运输' },
  { code: 'PIPELINE', name: '管道运输' },
  { code: 'LAND_BRIDGE', name: '大陆桥运输' },
]

// 多式联运单独一个选项（第 12 项），选中后展开多选，从上面 11 种里勾选实际组合
export const MULTIMODAL = { code: 'MULTIMODAL', name: '多式联运' }

// picker 的完整选项：11 种 + 多式联运
export const MODE_OPTIONS = [...TRANSPORT_MODES, MULTIMODAL]

// 视为海运类的方式：决定用 FOB/CFR/CIF 还是 FCA/CPT/CIP
const SEA_CODES = ['SEA_FCL', 'SEA_LCL', 'SEA_BULK', 'INLAND']

const FREIGHT_LABELS = {
  SEA_FCL: '海运费（整票）',
  SEA_LCL: '海运费（整票）',
  SEA_BULK: '海运费（整票）',
  AIR: '空运费',
  EXPRESS: '快递费',
  POST: '邮费',
  RAIL: '铁路运费',
  ROAD: '公路运费',
  INLAND: '内河运费',
  PIPELINE: '管道运费',
  LAND_BRIDGE: '大陆桥运费',
  MULTIMODAL: '全程运费（多式联运）',
}

/** 按代码查运输方式，找不到（含历史记录缺字段）回退第一项 */
export function getMode(code) {
  const c = String(code || '').toUpperCase()
  return MODE_OPTIONS.find((m) => m.code === c) || TRANSPORT_MODES[0]
}

/** 是否属于海运类：决定用 FOB/CFR/CIF 还是 FCA/CPT/CIP */
export function isSeaMode(code) {
  return SEA_CODES.indexOf(String(code || '').toUpperCase()) !== -1
}

/** 贸易术语名称：海运类 → FOB/CFR/CIF；其他 → FCA/CPT/CIP */
export function termNames(code) {
  return isSeaMode(code)
    ? { base: 'FOB', freight: 'CFR', insured: 'CIF' }
    : { base: 'FCA', freight: 'CPT', insured: 'CIP' }
}

/** 运费输入框标签，随运输方式变化 */
export function freightLabel(code) {
  const c = String(code || '').toUpperCase()
  return FREIGHT_LABELS[c] || FREIGHT_LABELS.SEA_FCL
}

/** 简称：去掉名称里的括号补充，用于组合展示（如「海运整柜 + 铁路运输」） */
export function modeShortName(code) {
  return getMode(code).name.replace(/（[^）]*）/g, '')
}
