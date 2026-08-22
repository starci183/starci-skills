import assert from "node:assert/strict";
import test from "node:test";
import {classifyFrontendChange} from "./classify-frontend-change.mjs";

test("an exact local label or spacing correction stays plain", () => {
  assert.deepEqual(classifyFrontendChange({decisionAlreadySpecified: true, sourceBoundaryKnown: true, copyOnly: true, domains: ["frontend"]}), {
    level: "micro", workflow: "plain", requiresDirection: false, approvalStages: 0, independentReviewer: false,
    proof: ["targeted-tests", "browser-if-visual"],
    reason: "The exact local decision and source boundary are already known and no architecture, owner or contract changes."
  });
});

test("one subtree state change routes to block without inventing page work", () => {
  const result = classifyFrontendChange({blockStateChanged: true, decisionAlreadySpecified: true, domains: ["frontend"]});
  assert.equal(result.level, "component");
  assert.equal(result.workflow, "block");
  assert.equal(result.requiresDirection, false);
  assert.equal(result.approvalStages, 1);
});

test("page architecture routes to layout", () => {
  const result = classifyFrontendChange({pageArchitectureChanged: true, domains: ["frontend"]});
  assert.equal(result.level, "page");
  assert.equal(result.workflow, "layout");
  assert.equal(result.independentReviewer, false);
});

test("capability and cross-domain work require full review", () => {
  assert.equal(classifyFrontendChange({contractChanged: true, domains: ["frontend"]}).level, "capability");
  const cross = classifyFrontendChange({componentAnatomyChanged: true, domains: ["frontend", "backend"]});
  assert.equal(cross.level, "cross-domain");
  assert.equal(cross.independentReviewer, true);
});

test("ambiguous cosmetic language is not silently treated as micro", () => {
  assert.throws(() => classifyFrontendChange({spacingOnly: true}), /ambiguous/);
});
