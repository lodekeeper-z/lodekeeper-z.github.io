// A standalone JavaScript semantics probe, not a Lodestar integration test.
// Run with: node assets/evidence/2026-11-09-promise-completion.mjs
import assert from "node:assert/strict";
import {setImmediate as nextTurn} from "node:timers/promises";

const unhandled = [];
const onUnhandled = (reason) => unhandled.push(reason);
process.on("unhandledRejection", onUnhandled);

try {
  // Positive control: prove the event observer can detect an unhandled rejection.
  const controlError = new Error("observer control");
  void Promise.reject(controlError);
  await nextTurn();
  assert.deepEqual(unhandled, [controlError]);
  unhandled.length = 0;

  let rejectSlow;
  const slow = new Promise((_, reject) => { rejectSlow = reject; });
  const result = await Promise.any([Promise.resolve(3), slow]);
  assert.equal(result, 3);
  // The aggregate has returned, but this input is still pending.
  rejectSlow(new Error("late publication failure"));
  await nextTurn();
  assert.deepEqual(unhandled, []);

  let rejectLast;
  const last = new Promise((_, reject) => { rejectLast = reject; });
  const publications = [Promise.resolve(3), last];
  let returned = false;
  const joined = (async () => {
    try {
      return await Promise.any(publications);
    } finally {
      await Promise.allSettled(publications);
    }
  })();
  const observed = joined.then((value) => { returned = true; return value; });
  await nextTurn();
  assert.equal(returned, false);
  rejectLast(new Error("last publication failure"));
  assert.equal(await observed, 3);
  assert.equal(returned, true);
  await nextTurn();
  assert.deepEqual(unhandled, []);

  console.log(JSON.stringify({
    node: process.version,
    observerPositiveControl: "pass",
    promiseAnyReturnsBeforeLastSettlement: true,
    lateRejectionUnhandledEvents: unhandled.length,
    allSettledFinallyDelaysReturn: true,
    resultPreserved: true,
  }, null, 2));
} finally {
  process.off("unhandledRejection", onUnhandled);
}
