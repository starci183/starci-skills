import assert from "node:assert/strict";
import test from "node:test";
import {isApprovalToken, isAutoModeRequest, transitionSession} from "./session-control.mjs";

const start = () => ({phase: "review", selectedCandidate: null, boundaryDisplayed: true, boundaryApproved: false, assumptionsValid: true, baselineVersion: 1});
const pageStart = () => ({phase: "page-review", envelopeAt: autoAt, selectedCandidate: null, boundaryDisplayed: true, boundaryApproved: false, sourceAuthorized: false, assumptionsValid: true, baselineVersion: 1});
const pageAt = "a".repeat(64);
const autoAt = "c".repeat(64);
const boundaryAt = "b".repeat(64);

test("A selects but does not authorize source writes", () => {
  const state = transitionSession(start(), {type: "select", candidateId: "a"});
  assert.equal(state.selectedCandidate, "a");
  assert.equal(state.boundaryApproved, false);
});

test("OK authorizes the displayed boundary and continue adds no checkpoint", () => {
  const selected = transitionSession(start(), {type: "select", candidateId: "a"});
  const approved = transitionSession(selected, {type: "approve", token: "ok"});
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
  const executing = transitionSession(transitionSession(start(), {type: "select", candidateId: "a"}), {type: "approve", token: "OK"});
  assert.throws(() => transitionSession(executing, {type: "complete", visualProofOk: false}), /green visual proof/);
});

test("first OK locks page anatomy in cache without authorizing source writes", () => {
  const selected = transitionSession(pageStart(), {type: "select", review: "pages", candidateId: "journey-led-pages"});
  const approved = transitionSession(selected, {type: "approve", token: "Ok", approvalKind: "pages", pageContractAt: pageAt});
  assert.equal(approved.phase, "state-expansion");
  assert.equal(approved.pageApproved, true);
  assert.equal(approved.pageContractAt, pageAt);
  assert.equal(approved.sourceAuthorized, false);
  assert.equal(approved.boundaryApproved, false);
});

test("second OK requires states bound to the approved page anatomy before source execution", () => {
  const pageSelected = transitionSession(pageStart(), {type: "select", review: "pages", candidateId: "journey-led-pages"});
  const pageApproved = transitionSession(pageSelected, {type: "approve", token: "oK", approvalKind: "pages", pageContractAt: pageAt});
  const stateReview = transitionSession(pageApproved, {type: "open-state-review", pageContractAt: pageAt, boundaryDisplayed: true});
  const stateSelected = transitionSession(stateReview, {type: "select", review: "states", candidateId: "journey-led-pages"});
  assert.throws(() => transitionSession(stateSelected, {type: "approve", token: "OK", pageContractAt: "b".repeat(64)}), /approved page contract/);
  const executing = transitionSession(stateSelected, {type: "approve", token: "OK", pageContractAt: pageAt});
  assert.equal(executing.phase, "executing");
  assert.equal(executing.sourceAuthorized, true);
});

test("state rejection preserves approved pages while page rejection resets the whole baseline", () => {
  const pageSelected = transitionSession(pageStart(), {type: "select", review: "pages", candidateId: "journey-led-pages"});
  const pageApproved = transitionSession(pageSelected, {type: "approve", token: "OK", approvalKind: "pages", pageContractAt: pageAt});
  const stateReview = transitionSession(pageApproved, {type: "open-state-review", pageContractAt: pageAt, boundaryDisplayed: true});
  const stateRejected = transitionSession(stateReview, {type: "reject", scope: "states"});
  assert.equal(stateRejected.phase, "state-expansion");
  assert.equal(stateRejected.pageApproved, true);
  assert.equal(stateRejected.pageContractAt, pageAt);

  const pageRejected = transitionSession(pageSelected, {type: "reject", scope: "pages"});
  assert.equal(pageRejected.phase, "baseline-required");
  assert.equal(pageRejected.pageApproved, false);
  assert.equal(pageRejected.pageContractAt, null);
});

test("approval accepts only a whole-message case-insensitive OK token", () => {
  for (const token of ["OK", "ok", "Ok", "oK", "  ok  "]) assert.equal(isApprovalToken(token), true);
  for (const token of ["continue", "okay", "OK now", "", undefined]) assert.equal(isApprovalToken(token), false);
  const selected = transitionSession(start(), {type: "select", candidateId: "a"});
  assert.throws(() => transitionSession(selected, {type: "approve", token: "continue"}), /whole-message OK token/);
});

test("auto mode requires explicit mode=auto and binds the immutable invocation envelope", () => {
  assert.equal(isAutoModeRequest("mode=auto"), true);
  assert.equal(isAutoModeRequest("design page mode=AUTO"), true);
  assert.equal(isAutoModeRequest("automatic"), false);
  assert.throws(() => transitionSession(pageStart(), {type: "configure-approval-mode", mode: "auto", request: "please continue", envelopeAt: autoAt}), /explicit mode=auto/);
  assert.throws(() => transitionSession(pageStart(), {type: "configure-approval-mode", mode: "auto", request: "mode=auto", envelopeAt: boundaryAt}), /must equal the session invocation envelope/);
  const configured = transitionSession(pageStart(), {type: "configure-approval-mode", mode: "auto", request: "mode=auto", envelopeAt: autoAt});
  assert.equal(configured.approvalMode, "auto");
  assert.equal(configured.autoApprovalAt, autoAt);
});

test("bound auto mode consumes page and source checkpoints without bypassing displayed contracts", () => {
  const configured = transitionSession(pageStart(), {type: "configure-approval-mode", mode: "auto", request: "layout mode=auto", envelopeAt: autoAt});
  assert.throws(() => transitionSession(configured, {type: "select", review: "pages", candidateId: "alternative"}), /evidence-backed recommendation/);
  const pageSelected = transitionSession(configured, {type: "select", review: "pages", candidateId: "recommended", recommended: true});
  const pageApproved = transitionSession(pageSelected, {type: "approve", auto: true, autoApprovalAt: autoAt, approvalKind: "pages", pageContractAt: pageAt});
  assert.equal(pageApproved.approvalEvidence, `AUTO:${autoAt}:OK #1:${pageAt}`);
  const stateReview = transitionSession(pageApproved, {type: "open-state-review", pageContractAt: pageAt, boundaryDisplayed: true});
  const stateSelected = transitionSession(stateReview, {type: "select", review: "states", candidateId: "recommended", recommended: true});
  assert.throws(() => transitionSession(stateSelected, {type: "approve", auto: true, autoApprovalAt: autoAt, pageContractAt: pageAt}), /source-boundary hash/);
  const sourceApproved = transitionSession(stateSelected, {type: "approve", auto: true, autoApprovalAt: autoAt, pageContractAt: pageAt, sourceBoundaryAt: boundaryAt});
  assert.equal(sourceApproved.sourceAuthorized, true);
  assert.equal(sourceApproved.approvalEvidence, `AUTO:${autoAt}:OK #2:${boundaryAt}`);
});

test("auto mode advances only the next completed step and refuses stale authority", () => {
  const state = transitionSession({
    phase: "review", envelopeAt: autoAt, stepTableDisplayed: true, activeStepIndex: 0,
    steps: [{id: "discover", status: "completed"}, {id: "plan", status: "waiting-for-ok"}, {id: "write", status: "waiting-for-ok"}],
  }, {type: "configure-approval-mode", mode: "auto", request: "mode=auto", envelopeAt: autoAt});
  assert.throws(() => transitionSession(state, {type: "advance-step", auto: true, autoApprovalAt: boundaryAt}), /whole-message OK token or bound auto authority/);
  const advanced = transitionSession(state, {type: "advance-step", auto: true, autoApprovalAt: autoAt});
  assert.equal(advanced.activeStepIndex, 1);
  assert.equal(advanced.steps[1].status, "in-progress");
  assert.equal(advanced.steps[2].status, "waiting-for-ok");
});

test("a displayed skill-step table advances exactly one completed row per OK", () => {
  const state = {
    stepTableDisplayed: true,
    activeStepIndex: 0,
    steps: [
      {id: "discover", status: "completed"},
      {id: "plan", status: "waiting-for-ok"},
      {id: "write", status: "waiting-for-ok"},
    ],
  };
  const advanced = transitionSession(state, {type: "advance-step", token: "ok"});
  assert.equal(advanced.activeStepIndex, 1);
  assert.equal(advanced.steps[1].status, "in-progress");
  assert.equal(advanced.steps[2].status, "waiting-for-ok");
  assert.throws(() => transitionSession(advanced, {type: "advance-step", token: "OK"}), /must complete/);
});
