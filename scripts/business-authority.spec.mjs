import assert from "node:assert/strict";
import test from "node:test";
import {proveBusinessTransition} from "./business-authority.mjs";

const implementedHead = "a".repeat(64);
const pendingHead = "b".repeat(64);
const progressHead = "c".repeat(64);
const legacy = {schemaVersion: 1};
const model = (status, previousHead, baseHead = implementedHead) => ({schemaVersion: 2, authority: {status, basis: status === "implemented" ? "reconciled" : "owner-intent", requiredRoles: ["fe"], previousHead, ...(baseHead ? {baseHead} : {})}});
const implemented = (head, claim = "Same business claim", startLine = 1) => ({
  schemaVersion: 2,
  authority: {status: "implemented", basis: "reconciled", requiredRoles: ["fe"], previousHead: implementedHead, baseHead: implementedHead},
  featureId: "feature",
  title: "Feature",
  sources: [{role: "fe", repository: "https://example.test/repo", head}],
  evidence: [{id: "EV-001", role: "fe", path: "src/page.tsx", startLine, endLine: startLine + 1, claim, kind: "ui"}],
  rules: [{id: "BR-01", statement: "Stable rule", evidenceIds: ["EV-001"]}],
});

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

test("accepts implemented technical reconciliation when only source heads and evidence lines move", () => {
  const previous = implemented("1".repeat(40), "Same business claim", 1);
  const next = implemented("2".repeat(40), "Same business claim", 8);
  assert.doesNotThrow(() => proveBusinessTransition(implementedHead, previous, next));
});

test("rejects implemented technical reconciliation that changes business or evidence claims", () => {
  const previous = implemented("1".repeat(40));
  assert.throws(
    () => proveBusinessTransition(implementedHead, previous, implemented("2".repeat(40), "Changed claim")),
    /cannot change business claims/,
  );
  const changedRule = implemented("2".repeat(40));
  changedRule.rules[0].statement = "Changed business rule";
  assert.throws(() => proveBusinessTransition(implementedHead, previous, changedRule), /cannot change business claims/);
});

test("rejects technical reconciliation with an unbound predecessor", () => {
  const previous = implemented("1".repeat(40));
  const next = implemented("2".repeat(40));
  next.authority.previousHead = "f".repeat(64);
  assert.throws(() => proveBusinessTransition(implementedHead, previous, next), /previousHead/);
});
