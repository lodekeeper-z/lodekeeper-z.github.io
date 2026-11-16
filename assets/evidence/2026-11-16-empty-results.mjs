// Focused source-level probes, not the Lodestar test suite or a network simulation.
// Run with Node.js 22.22.0 (uses experimental stripTypeScriptTypes in transform mode):
// node assets/evidence/2026-11-16-empty-results.mjs
// Sources are fetched from immutable public commits. Only dependency imports are
// removed; the exported functions, class, and decision logic remain unchanged.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {stripTypeScriptTypes} from "node:module";

const sources = [];
async function load(revision, path, expectedImports) {
  const url = `https://raw.githubusercontent.com/ChainSafe/lodestar/${revision}/${path}`;
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  const source = await response.text();
  const imports = source.match(/^import .+;\r?\n/gm) ?? [];
  assert.equal(imports.length, expectedImports, "Unexpected source import shape");
  const withoutImports = source.replace(/^import .+;\r?\n/gm, "");
  const js = stripTypeScriptTypes(withoutImports, {mode: "transform"});
  sources.push({revision, path, sha256: createHash("sha256").update(source).digest("hex")});
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}

const bitPath = "packages/beacon-node/src/util/bitArray.ts";
const doppelPath = "packages/validator/src/services/doppelgangerService.ts";
const [oldBits, newBits, oldDoppel, newDoppel] = await Promise.all([
  load("8a64241e1ba670a1abb0fad922ac071a9afbc529", bitPath, 1),
  load("6c6b758cc78397ddfcc9a070e7e084e06462c88a", bitPath, 1),
  load("5c2cf84ec1669c5a6822d5501443a5ba396c0c70", doppelPath, 8),
  load("42cba9af41f7fab39f62ff8bd6d0ae80315e55c9", doppelPath, 8),
]);

function members(bytes) {
  const result = new Set();
  for (let i = 0; i < bytes.length * 8; i++) {
    if (bytes[Math.floor(i / 8)] & (1 << (i % 8))) result.add(i);
  }
  return result;
}
function oracle(a, b) {
  const aa = members(a), bb = members(b);
  const aInB = [...aa].every((i) => bb.has(i));
  const bInA = [...bb].every((i) => aa.has(i));
  if (aInB && bInA) return "Equal";
  if (bInA) return "Superset";
  if (aInB) return "Subset";
  return [...aa].some((i) => bb.has(i)) ? "Intersect" : "Exclusive";
}
function classify(module, a, b) {
  return module.IntersectResult[module.intersectUint8Arrays(Uint8Array.from(a), Uint8Array.from(b))];
}

const exhaustive = {cases: 0, beforeMismatches: 0, afterMismatches: 0};
for (let a = 0; a < 256; a++) {
  for (let b = 0; b < 256; b++) {
    const want = oracle([a], [b]);
    exhaustive.cases++;
    exhaustive.beforeMismatches += classify(oldBits, [a], [b]) !== want;
    exhaustive.afterMismatches += classify(newBits, [a], [b]) !== want;
  }
}
assert.equal(exhaustive.afterMismatches, 0);
assert.ok(exhaustive.beforeMismatches > 0);
const crossByte = [
  [[0xff, 0x0f], [0x0f, 0x00]],
  [[0x0f, 0x00], [0xff, 0x0f]],
  [[0x0f, 0x00], [0x00, 0xf0]],
  [[0xff, 0x0f, 0], [0x0f, 0, 0xf0]],
  [[0x0f, 0x01], [0x0f]],
].map(([a, b]) => {
  const expected = oracle(a, b);
  const before = classify(oldBits, a, b), after = classify(newBits, a, b);
  assert.equal(after, expected);
  return {a, b, expected, before, after};
});
// Structural stand-ins for BitArray's two fields: not SSZ constructor/decoder tests.
const longer = {uint8Array: Uint8Array.from([0xff]), bitLen: 8};
const shorter = {uint8Array: Uint8Array.from([0x0f]), bitLen: 7};
const unequalBitLengths = {
  before: oldBits.isSuperSetOrEqual(longer, shorter),
  after: newBits.isSuperSetOrEqual(longer, shorter),
};
assert.deepEqual(unequalBitLengths, {before: true, after: false});

async function doppelProbe(module, kind) {
  let shutdowns = 0;
  const logger = {info() {}, error() {}};
  const clock = {runEveryEpoch() {}}; // No scheduler or networking is exercised.
  const api = {validator: {async getLiveness() {
    return {ok: false, error: () => new Error("controlled failed response")};
  }}};
  const service = new module.DoppelgangerService(logger, clock, api, {}, {}, () => shutdowns++, null);
  const key = "fixture";
  service.doppelgangerStateByPubkey.set(key, {remainingEpochs: 1, nextEpochToCheck: 9});
  const previous = {epoch: 9, responses: [{index: 0, isLive: false}]};
  let current;
  if (kind === "failed-current-request") current = await service.getLiveness(10, [0]);
  else if (kind === "missing-index-in-partial-response") current = {epoch: 10, responses: [{index: 1, isLive: false}]};
  else current = {epoch: 10, responses: [{index: 0, isLive: kind === "live-current-response"}]};
  service.detectDoppelganger(10, previous, current, new Map([[0, key]]));
  return {status: service.getStatus(key), shutdowns};
}
const doppelganger = [];
for (const kind of ["failed-current-request", "missing-index-in-partial-response", "explicit-not-live-response", "live-current-response"]) {
  const before = await doppelProbe(oldDoppel, kind), after = await doppelProbe(newDoppel, kind);
  if (kind === "failed-current-request" || kind === "missing-index-in-partial-response") {
    assert.equal(before.status, "VerifiedSafe");
    assert.equal(after.status, "Unverified");
  } else if (kind === "explicit-not-live-response") {
    assert.equal(before.status, "VerifiedSafe");
    assert.equal(after.status, "VerifiedSafe");
  } else {
    assert.equal(before.status, "DoppelgangerDetected");
    assert.equal(after.status, "DoppelgangerDetected");
    assert.equal(after.shutdowns, 1);
  }
  doppelganger.push({kind, before, after});
}
sources.sort((a, b) => a.path.localeCompare(b.path) || a.revision.localeCompare(b.revision));
console.log(JSON.stringify({node: process.version, sources, exhaustive, crossByte, unequalBitLengths, doppelganger, assertions: "passed"}, null, 2));
