import assert from "node:assert/strict";
import test from "node:test";
import {summarizeRunMetrics} from "./summarize-run-metrics.mjs";

const run = (level, wallTimeMs, tokens, overrides = {}) => ({
  status: "complete",
  impact: {level},
  metrics: {
    wallTimeMs,
    tokenUsage: tokens == null ? {status: "unavailable"} : {status: "measured", total: tokens},
    approvalsChangedDecision: 0,
    uniqueDefectsCaught: 0,
    falsePositiveGates: 0,
    coordinatorReworkCount: 0,
    artifactsCreated: 1,
    ...overrides
  }
});

test("groups operational evidence by impact rather than mixing unlike work", () => {
  const result = summarizeRunMetrics([
    run("page", 100, 20, {uniqueDefectsCaught: 2}),
    run("page", 300, null, {falsePositiveGates: 1}),
    run("component", 50, 10),
    {status: "planned", impact: {level: "page"}}
  ]);
  assert.deepEqual(result.page.wallTimeMs, {average: 200, median: 200});
  assert.deepEqual(result.page.tokenUsage, {measuredRuns: 1, average: 20});
  assert.equal(result.page.uniqueDefectsCaught, 2);
  assert.equal(result.page.falsePositiveGates, 1);
  assert.equal(result.component.runs, 1);
});
