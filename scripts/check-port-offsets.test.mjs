import assert from "node:assert/strict";
import test from "node:test";

test("application slots shift both sides of a pair by the Source slot step", () => {
  const resolvePort = (basePort, offset, slot, slotStep) => basePort + offset + slot * slotStep;
  assert.equal(resolvePort(2999, 67, 1, 1000), 4066);
  assert.equal(resolvePort(3000, 67, 1, 1000), 4067);
});

test("shared services ignore application slots", () => {
  assert.equal(5432 + 67, 5499);
});
