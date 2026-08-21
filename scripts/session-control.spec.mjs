import assert from "node:assert/strict";
import test from "node:test";
import {transitionSession} from "./session-control.mjs";

const start = () => ({phase: "review", selectedCandidate: null, boundaryDisplayed: true, boundaryApproved: false, assumptionsValid: true, baselineVersion: 1});

test("A selects but does not authorize source writes", () => {
  const state = transitionSession(start(), {type: "select", candidateId: "a"});
  assert.equal(state.selectedCandidate, "a");
  assert.equal(state.boundaryApproved, false);
});

test("OK authorizes the displayed boundary and continue adds no checkpoint", () => {
  const selected = transitionSession(start(), {type: "select", candidateId: "a"});
  const approved = transitionSession(selected, {type: "approve"});
  assert.equal(approved.phase, "executing");
  assert.deepEqual(transitionSession(approved, {type: "continue"}), approved);
});

test("owner rejection invalidates selection and requires a new baseline", () => {
  const state = transitionSession(start(), {type: "reject"});
  assert.equal(state.phase, "baseline-required");
  assert.equal(state.assumptionsValid, false);
  assert.equal(state.baselineVersion, 2);
});

test("completion is refused without green visual proof", () => {
  const executing = transitionSession(transitionSession(start(), {type: "select", candidateId: "a"}), {type: "approve"});
  assert.throws(() => transitionSession(executing, {type: "complete", visualProofOk: false}), /green visual proof/);
});
