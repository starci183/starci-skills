import assert from "node:assert/strict";
import test from "node:test";
import {proveBusinessTransition} from "./business-authority.mjs";

const implementedHead = "a".repeat(64);
const pendingHead = "b".repeat(64);
const progressHead = "c".repeat(64);
const legacy = {schemaVersion: 1};
const model = (status, previousHead, baseHead = implementedHead) => ({schemaVersion: 2, authority: {status, basis: status === "implemented" ? "reconciled" : "owner-intent", requiredRoles: ["fe"], previousHead, ...(baseHead ? {baseHead} : {})}});

test("accepts implemented to pending to in-progress to implemented", () => {
  const pending = model("pending", implementedHead);
  const progress = model("in-progress", pendingHead);
  assert.doesNotThrow(() => proveBusinessTransition(implementedHead, legacy, pending));
  assert.doesNotThrow(() => proveBusinessTransition(pendingHead, pending, progress));
  assert.doesNotThrow(() => proveBusinessTransition(progressHead, progress, model("implemented", progressHead)));
});

test("accepts rejection branches and rejects skipped implementation", () => {
  const pending = model("pending", implementedHead);
  assert.doesNotThrow(() => proveBusinessTransition(pendingHead, pending, model("rejected", pendingHead)));
  assert.throws(() => proveBusinessTransition(pendingHead, pending, model("implemented", pendingHead)), /invalid business authority transition/);
});

test("preserves baseHead and immediate predecessor", () => {
  const pending = model("pending", implementedHead);
  assert.throws(() => proveBusinessTransition(pendingHead, pending, model("in-progress", "d".repeat(64))), /previousHead/);
  assert.throws(() => proveBusinessTransition(pendingHead, pending, model("in-progress", pendingHead, "e".repeat(64))), /baseHead/);
});
