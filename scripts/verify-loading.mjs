// 临时自测脚本：在 Node 中直接跑 src/utils/calc.js 的装柜纯函数
// 用法：node scripts/verify-loading.mjs
import { readFileSync } from 'node:fs'

const raw = readFileSync(new URL('../src/utils/calc.js', import.meta.url), 'utf8').replace(/export\s+/g, '')
const src =
  raw +
  '\nexport { calcLoading, bestPacking, deriveTotalBoxes, planContainers, compareContainers, CONTAINERS, safeNumber, formatNumber };'
const mod = await import('data:text/javascript,' + encodeURIComponent(src))
const { calcLoading, bestPacking, deriveTotalBoxes, planContainers, compareContainers, CONTAINERS } = mod

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
function eq(name, actual, expected) {
  ok(name, actual === expected, `实际=${actual} 期望=${expected}`)
}
function finite(name, value) {
  ok(name, typeof value === 'number' && Number.isFinite(value), `${value} (需为有限数)`)
}

// ---- 默认箱规：50 × 40 × 30 cm / 12 kg ----
const BOX = { length: 50, width: 40, height: 30, grossWeight: 12 }

console.log('===== 用例 0：柜型表 =====')
eq('柜型数量 = 8', Object.keys(CONTAINERS).length, 8)
eq('默认首选柜型 20GP 内尺寸 L', CONTAINERS['20GP'].innerLength, 589)
eq('20GP 内尺寸 W', CONTAINERS['20GP'].innerWidth, 234)
eq('20GP 内尺寸 H', CONTAINERS['20GP'].innerHeight, 238)
eq('45HQ 内尺寸 L', CONTAINERS['45HQ'].innerLength, 1355)
eq('40RF 限重', CONTAINERS['40RF'].maxWeight, 26000)
// 老字段仍在，老记忆可用
eq('20GP 保留 usableVolume', CONTAINERS['20GP'].usableVolume, 28)
eq('40HQ 保留 innerVolume', CONTAINERS['40HQ'].innerVolume, 76.4)

console.log('\n===== 用例 1：6 种摆法枚举（20GP 内 589×234×238 放 50×40×30）=====')
const L = CONTAINERS['20GP'].innerLength
const W = CONTAINERS['20GP'].innerWidth
const H = CONTAINERS['20GP'].innerHeight
const perms = [
  [50, 40, 30],
  [50, 30, 40],
  [40, 50, 30],
  [40, 30, 50],
  [30, 50, 40],
  [30, 40, 50],
]
let maxBoxes = -1
let maxLayout = null
for (const [a, b, c] of perms) {
  const x = Math.floor(L / a)
  const y = Math.floor(W / b)
  const z = Math.floor(H / c)
  const boxes = x * y * z
  if (boxes > maxBoxes) {
    maxBoxes = boxes
    maxLayout = { x, y, z }
  }
  console.log(`      摆法 ${a}×${b}×${c} → ${x} × ${y} × ${z} = ${boxes} 箱`)
}
const pack = bestPacking({ length: L, width: W, height: H }, { length: 50, width: 40, height: 30 })
eq('bestPacking 最优箱数 = 392', pack.boxes, 392)
eq('bestPacking 最优摆法 x', pack.x, maxLayout.x)
eq('bestPacking 最优摆法 y', pack.y, maxLayout.y)
eq('bestPacking 最优摆法 z', pack.z, maxLayout.z)
eq('最优摆法 = 14 × 4 × 7', `${pack.x} × ${pack.y} × ${pack.z}`, '14 × 4 × 7')
ok('6 种摆法里最大者一致', pack.boxes === maxBoxes, `bestPacking=${pack.boxes} 手算=${maxBoxes}`)

console.log('\n===== 用例 2：默认参数（50×40×30 / 12kg / 20GP / 85%）=====')
const l = calcLoading({ ...BOX, containerType: '20GP', loadRate: 85 })
eq('体积可装 = 396', l.volumeBoxes, 396)
eq('几何码放 = 392', l.packBoxes, 392)
eq('重量可装 = 1458', l.weightBoxes, 1458)
eq('可装 = min(396,392,1458) = 392', l.boxes, 392)
eq('限制因素 = packing', l.limitBy, 'packing')
eq('packLayout 透出', `${l.packLayout.x} × ${l.packLayout.y} × ${l.packLayout.z}`, '14 × 4 × 7')
close('总方数 = 392 × 0.06', l.totalVolume, 23.52)
close('总毛重 = 392 × 12', l.totalWeight, 4704)
close('利用率 = 23.52 / 28', l.utilization, 84.0, 0.01)

console.log('\n===== 用例 3：超重场景（单箱 30kg）=====')
// 20GP 限重 17500：floor(17500/30)=583 > 码放 392，仍受码放限制（不是重量）
const heavyGp = calcLoading({ ...BOX, grossWeight: 30, containerType: '20GP', loadRate: 85 })
eq('20GP/30kg 重量可装 = 583', heavyGp.weightBoxes, 583)
eq('20GP/30kg 仍受码放限制（码放 392 < 重量 583）', heavyGp.limitBy, 'packing')
// 40HQ 限重 22000：floor(22000/30)=733 < 码放 1050、体积 963 → 受重量限制
const heavyHq = calcLoading({ ...BOX, grossWeight: 30, containerType: '40HQ', loadRate: 85 })
eq('40HQ/30kg 体积可装 = 963', heavyHq.volumeBoxes, 963)
eq('40HQ/30kg 几何码放 = 1050', heavyHq.packBoxes, 1050)
eq('40HQ/30kg 重量可装 = 733', heavyHq.weightBoxes, 733)
eq('40HQ/30kg 可装 = min(963,1050,733) = 733', heavyHq.boxes, 733)
eq('40HQ/30kg 限制因素 = weight', heavyHq.limitBy, 'weight')

console.log('\n===== 用例 4：装载率降到 40% → 体积可装变小并成为限制 =====')
const low = calcLoading({ ...BOX, containerType: '20GP', loadRate: 40 })
eq('40% 体积可装 = 186', low.volumeBoxes, 186)
eq('40% 几何码放仍 = 392', low.packBoxes, 392)
eq('40% 可装 = 186', low.boxes, 186)
eq('40% 限制因素 = volume', low.limitBy, 'volume')
ok('40% 体积可装 < 85% 体积可装', low.volumeBoxes < l.volumeBoxes, `${low.volumeBoxes} < ${l.volumeBoxes}`)

console.log('\n===== 用例 5：多柜分配（1,026 箱 / 20GP，每柜 392）=====')
eq('推导总箱数（totalBoxes 优先）', deriveTotalBoxes({ totalBoxes: 1026, totalQty: 1, perBoxQty: 1 }), 1026)
eq('推导总箱数（件数 ÷ 每箱件数 向上取整）', deriveTotalBoxes({ totalQty: 4000, perBoxQty: 3 }), 1334)
eq('推导总箱数（两者都缺 → 0）', deriveTotalBoxes({}), 0)
eq('推导总箱数（有件数无每箱件数 → 0）', deriveTotalBoxes({ totalQty: 1000 }), 0)
const plan5 = planContainers(1026, 392)
eq('需要 3 个柜', plan5.count, 3)
eq('每柜明细 = 392 + 392 + 242', plan5.list.join(','), '392,392,242')
const planExact = planContainers(784, 392)
eq('正好装完 → 2 个柜（不额外空柜）', planExact.count, 2)
eq('正好装完明细 = 392,392', planExact.list.join(','), '392,392')

console.log('\n===== 用例 6：柜型对比（1,026 箱，箱规 50×40×30 / 12kg）=====')
const cmp = compareContainers({ ...BOX }, 1026)
console.log('      ' + cmp.map((c) => `${c.type} ${c.count} 个`).join('   '))
ok('对比表按柜数升序', cmp.every((c, i) => i === 0 || cmp[i - 1].count <= c.count), cmp.map((c) => c.count).join(','))
ok('并列时柜型从小到大（内容积升序）', cmp.every((c, i) => i === 0 || cmp[i - 1].count < c.count || cmp[i - 1].innerVolume <= c.innerVolume))
const c20 = cmp.find((c) => c.type === '20GP')
const c40hq = cmp.find((c) => c.type === '40HQ')
eq('20GP 每柜 392 → 3 个', c20.count, 3)
eq('40HQ 每柜 963 → 2 个', c40hq.count, 2)
ok('40HQ 柜数 ≤ 20GP 柜数', c40hq.count <= c20.count, `${c40hq.count} <= ${c20.count}`)

console.log('\n===== 用例 7：边界（尺寸 0 / 总箱数 0 / 每箱件数 0）不得 NaN =====')
const zeroDim = calcLoading({ length: 0, width: 0, height: 0, grossWeight: 0, containerType: '20GP', loadRate: 85 })
for (const [k, v] of Object.entries(zeroDim)) {
  if (typeof v === 'number') finite(`zeroDim.${k}`, v)
}
eq('尺寸 0 → 可装 0', zeroDim.boxes, 0)
eq('尺寸 0 → 码放 0', zeroDim.packBoxes, 0)
eq('尺寸 0 → limitBy=null', zeroDim.limitBy, null)
const bp0 = bestPacking({ length: 589, width: 234, height: 238 }, { length: 0, width: 0, height: 0 })
eq('bestPacking 尺寸 0 → boxes 0', bp0.boxes, 0)
ok('bestPacking 尺寸 0 → 无 NaN', Number.isFinite(bp0.x) && Number.isFinite(bp0.y) && Number.isFinite(bp0.z))
eq('总箱数 0 → 不分配柜', planContainers(0, 392).count, 0)
eq('每箱可装 0 → 不分配柜', planContainers(1026, 0).count, 0)
eq('每箱可装 0 → 明细空', planContainers(1026, 0).list.length, 0)
eq('每箱件数 0 → 推导总箱数 0', deriveTotalBoxes({ totalQty: 1000, perBoxQty: 0 }), 0)
const cmpZero = compareContainers({ ...BOX }, 0)
ok('0 箱对比 → 全部 count=0 且有限', cmpZero.every((c) => c.count === 0 && Number.isFinite(c.perBoxes)))
// 单箱重量 0、装载率空 / 0 也不得 NaN
for (const input of [
  { ...BOX, grossWeight: 0 },
  { ...BOX, loadRate: '' },
  { ...BOX, loadRate: 0 },
]) {
  const r = calcLoading({ ...input, containerType: '20GP' })
  const bad = Object.entries(r).filter(([, v]) => typeof v === 'number' && !Number.isFinite(v))
  ok(`边界输入 ${JSON.stringify(input)} 无 NaN`, bad.length === 0, bad.map(([k]) => k).join(','))
}

console.log(`\n===== 汇总：PASS=${pass}  FAIL=${fail} =====`)
process.exit(fail === 0 ? 0 : 1)
