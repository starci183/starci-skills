import assert from "node:assert/strict";
import test from "node:test";
import {boundaryFailures} from "./business-write-boundary.mjs";

const head = "a".repeat(64);
const base = "b".repeat(64);
const previous = "c".repeat(64);
const sourceHead = "d".repeat(40);
const entry = {head, authorityStatus: "in-progress"};
const model = {__head: head, schemaVersion: 2, authority: {status: "in-progress", baseHead: base, previousHead: previous}, sources: [{role: "fe", head: sourceHead}]};

test("accepts an exact in-progress write boundary", () => {
  assert.deepEqual(boundaryFailures({featureId: "course-learning", entry, model, businessImpact: "affects", expectedStatus: "in-progress", role: "fe", baseline: sourceHead}), []);
});

test("rejects pending and rejected source writes", () => {
  for (const status of ["pending", "rejected"]) {
    const failures = boundaryFailures({featureId: "course-learning", entry: {...entry, authorityStatus: status}, model: {...model, authority: {...model.authority, status}}, businessImpact: "affects", role: "fe", baseline: sourceHead});
    assert.ok(failures.length > 0);
  }
});

test("technical work requires implemented truth and creates no intent", () => {
  const implemented = {__head: head, schemaVersion: 1, sources: [{role: "fe", head: sourceHead}]};
  assert.deepEqual(boundaryFailures({featureId: "course-learning", entry: {head}, model: implemented, businessImpact: "none", role: "fe", baseline: sourceHead}), []);
  assert.ok(boundaryFailures({featureId: "course-learning", entry, model, businessImpact: "none"}).length > 0);
});

test("rejects a source baseline that was not bound by business", () => {
  assert.ok(boundaryFailures({featureId: "course-learning", entry, model, businessImpact: "affects", role: "fe", baseline: "e".repeat(40)}).some((failure) => failure.includes("baseline")));
});
