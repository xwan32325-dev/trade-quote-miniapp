// 临时自测脚本：在 Node 中直接跑 src/utils/calc.js 的纯函数
// 用法：node scripts/verify-calc.mjs
import { readFileSync } from 'node:fs';
const raw = readFileSync(new URL('../src/utils/calc.js', import.meta.url), 'utf8').replace(/export\s+/g, '');
// 去掉 export 后顶层仅剩函数声明，追加一行导出以便动态导入拿到函数
const src = raw + '\nexport { calcQuote, calcLoading, CONTAINERS, safeNumber };';
const mod = await import('data:text/javascript,' + encodeURIComponent(src));
const { calcQuote, calcLoading } = mod;

let pass = 0;
let fail = 0;
const TOL = 0.02;

function close(name, actual, expected, tol = TOL) {
  const ok = Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: 实际=${actual}  期望≈${expected}`);
}
function eq(name, actual, expected) {
  const ok = actual === expected;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: 实际=${actual}  期望=${expected}`);
}
function finite(name, value) {
  const ok = typeof value === 'number' && Number.isFinite(value);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${value}  (需为有限数)`);
}

console.log('===== 用例 1：报价 =====');
const q = calcQuote({
  price: 100, qty: 1000, vatRate: 13, rebateRate: 13, domesticFee: 2000,
  exchangeRate: 7.1, profitRate: 10, freight: 500, insuranceRate: 0.3, markupRate: 10,
});
close('退税额合计', q.refundTotal, 11504.42);
close('出口总成本', q.totalCost, 90495.58);
close('FOB 总价', q.fobTotal, 14020.44);
close('FOB 单价', q.fobUnit, 14.02);
close('CFR 总价', q.cfrTotal, 14520.44);
close('CIF 总价', q.cifTotal, 14568.53);
close('保险费', q.insurance, 48.08);
close('换汇成本', q.exchangeCost, 6.4546);
eq('换汇成本 < 汇率 → 盈利', q.isProfit, true);
close('盈亏率%', q.profitPct, 10.00);

console.log('\n===== 用例 2：装柜 =====');
const l = calcLoading({
  length: 50, width: 40, height: 30, grossWeight: 12,
  containerType: '20GP', loadRate: 85,
});
close('单箱体积 CBM', l.boxVolume, 0.06);
eq('体积可装箱数', l.volumeBoxes, 396);
eq('重量可装箱数', l.weightBoxes, 1458);
eq('最终可装箱数', l.boxes, 396);
eq('受体积限制', l.limitBy, 'volume');
close('总方数', l.totalVolume, 23.76);
close('总毛重', l.totalWeight, 4752);

console.log('\n===== 用例 3：边界（数量 0 / 汇率 0 / 单箱尺寸 0）=====');
const q3 = calcQuote({ price: 100, qty: 0, vatRate: 13, rebateRate: 13, domesticFee: 2000, exchangeRate: 0, profitRate: 10, freight: 500, insuranceRate: 0.3, markupRate: 10 });
const l3 = calcLoading({ length: 0, width: 0, height: 0, grossWeight: 0, containerType: '20GP', loadRate: 85 });
for (const [k, v] of Object.entries(q3)) {
  if (typeof v === 'number') finite(`quote.${k}`, v);
}
for (const [k, v] of Object.entries(l3)) {
  if (typeof v === 'number') finite(`loading.${k}`, v);
}
eq('边界装柜 可装箱数=0', l3.boxes, 0);
eq('边界装柜 限制=null', l3.limitBy, null);

console.log(`\n===== 汇总：PASS=${pass}  FAIL=${fail} =====`);
process.exit(fail === 0 ? 0 : 1);
