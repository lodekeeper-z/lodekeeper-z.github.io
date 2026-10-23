// Arithmetic-only reproduction for Day 107. No node or network measurements.
// Spec revision: 3dad3d5183756fc64c51e73d8b21026dd2330f22
// Lodestar revision: 4e12403e398cd09c6e8819265f1684ed386c2ec7
// Lodestar-Z revision: 268208de4f5aa559e2fb542fd3643e534d81004c
// Run: node assets/evidence/2026-10-23-rounding-policy.mjs
import assert from 'node:assert/strict';

const basisPointsScale = 10_000n;
const floorPolicy = (slotMs, bps) => Number(BigInt(slotMs) * BigInt(bps) / basisPointsScale);
const halfUpPolicy = (slotMs, bps) => Number((BigInt(slotMs) * BigInt(bps) + basisPointsScale / 2n) / basisPointsScale);
const typescriptPolicy = (slotMs, bps) => Math.round((slotMs * bps) / Number(basisPointsScale));

// Values include unchanged controls and an exact half-millisecond tie.
const cases = [
  {slotMs: 12_000, bps: 3333, floor: 3999, halfUp: 4000},
  {slotMs: 12_000, bps: 6667, floor: 8000, halfUp: 8000},
  {slotMs: 12_000, bps: 1667, floor: 2000, halfUp: 2000},
  {slotMs: 6_000, bps: 3333, floor: 1999, halfUp: 2000},
  {slotMs: 6_000, bps: 6667, floor: 4000, halfUp: 4000},
  {slotMs: 10_000, bps: 3333, floor: 3333, halfUp: 3333},
  {slotMs: 10_000, bps: 1667, floor: 1667, halfUp: 1667},
  {slotMs: 10_000, bps: 2500, floor: 2500, halfUp: 2500},
  {slotMs: 5_000, bps: 1667, floor: 833, halfUp: 834},
];
for (const c of cases) {
  assert.equal(floorPolicy(c.slotMs, c.bps), c.floor);
  assert.equal(halfUpPolicy(c.slotMs, c.bps), c.halfUp);
  assert.equal(typescriptPolicy(c.slotMs, c.bps), c.halfUp);
}

const receiptBoundary = [3998, 3999, 4000].map(elapsedMs => ({
  elapsedMs,
  timelyUnderFloor: elapsedMs < floorPolicy(12_000, 3333),
  timelyUnderHalfUp: elapsedMs < halfUpPolicy(12_000, 3333),
}));
assert.deepEqual(receiptBoundary, [
  {elapsedMs: 3998, timelyUnderFloor: true, timelyUnderHalfUp: true},
  {elapsedMs: 3999, timelyUnderFloor: false, timelyUnderHalfUp: true},
  {elapsedMs: 4000, timelyUnderFloor: false, timelyUnderHalfUp: false},
]);
// Confirm that reverting to floor is detected by the new expected result.
assert.throws(() => assert.equal(floorPolicy(12_000, 3333), 4000), assert.AssertionError);
console.log(JSON.stringify({assertions: 'passed', cases, receiptBoundary, floorMutation: 'detected'}, null, 2));
