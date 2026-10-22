// Arithmetic-only reproduction for Day 106. Not a Lodestar integration test.
// Run: node assets/evidence/2026-10-22-deadline-boundaries.mjs
// Inputs are illustrative, not observations from a running Ethereum node.
// Source contracts:
// https://github.com/ChainSafe/lodestar/pull/10455
// https://github.com/ChainSafe/lodestar/pull/10456
// https://github.com/ethereum/consensus-specs/blob/v1.7.0-beta.4/specs/phase0/fork-choice.md
import assert from "node:assert/strict";

const slotStartMs = Date.parse("2026-10-22T00:00:00Z");
const observedMs = slotStartMs + 1667;
const roundTripMs = (observedMs / 1000 - slotStartMs / 1000) * 1000;
const directMs = observedMs - slotStartMs;
const proposerCutoffMs = 1667;
const timestampCase = {
  slotStartMs,
  observedMs,
  roundTripMs,
  directMs,
  roundTripOnTime: roundTripMs <= proposerCutoffMs,
  directOnTime: directMs <= proposerCutoffMs,
};
assert.equal(timestampCase.roundTripOnTime, false);
assert.equal(timestampCase.directOnTime, true);
assert.equal(directMs, 1667);

const basisPoints = 3333;
const slotDurationMs = 12000;
const fractionMs = basisPoints * slotDurationMs / 10000;
const roundedDeadlineMs = Math.round(fractionMs);
const flooredDeadlineMs = Math.floor(fractionMs);
const receiptDelayMs = 3999;
const durationCase = {
  slotDurationMs,
  basisPoints,
  fractionMs,
  roundedDeadlineMs,
  flooredDeadlineMs,
  receiptDelayMs,
  roundedTimely: receiptDelayMs < roundedDeadlineMs,
  flooredTimely: receiptDelayMs < flooredDeadlineMs,
};
assert.equal(roundedDeadlineMs, 4000);
assert.equal(flooredDeadlineMs, 3999);
assert.equal(durationCase.roundedTimely, true);
assert.equal(durationCase.flooredTimely, false);

const beforeCutoffMs = slotStartMs + proposerCutoffMs - 1;
const afterCutoffMs = slotStartMs + proposerCutoffMs + 1;
assert.equal(beforeCutoffMs - slotStartMs <= proposerCutoffMs, true);
assert.equal(afterCutoffMs - slotStartMs <= proposerCutoffMs, false);
assert.equal(flooredDeadlineMs - 1 < flooredDeadlineMs, true);
assert.equal(flooredDeadlineMs < flooredDeadlineMs, false);

console.log(JSON.stringify({
  scope: "Arithmetic demonstration only; no client suite or live node was run.",
  timestampCase,
  durationCase,
  assertions: "passed",
}, null, 2));
