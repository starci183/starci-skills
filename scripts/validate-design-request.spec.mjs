import assert from "node:assert/strict";
import {test} from "node:test";
import {validateDesignRequest, validateRejectLinks, validateRejectsTable} from "./validate-design-request.mjs";

function openRequest() {
  return {
    schemaVersion: 1,
    id: "2026-08-23-example",
    status: "open",
    createdOn: "2026-08-23",
    updatedOn: "2026-08-23",
    project: "starci-academy",
    role: "fe",
    scope: {kinds: ["ui"], feature: "example surface", surfaces: ["/example"], sourceBoundary: []},
    feedback: {summary: "The current icon is ambiguous.", expectedOutcome: "Use a function-specific icon.", evidence: [{kind: "conversation", ref: "owner-feedback:example"}]},
    authority: {disposition: "pending", grammarTargets: [], principleTargets: [], evidence: []},
    implementation: {status: "applied", paths: ["src/example.tsx"], rejectRefs: []},
    proof: {status: "passed", evidence: ["test:example"]},
  };
}

test("accepts one normalized open request", () => {
  assert.deepEqual(validateDesignRequest(openRequest(), "2026-08-23-example.request.json"), []);
});

test("refuses an open request before source and proof are applied", () => {
  const value = openRequest();
  value.implementation = {status: "pending", paths: [], rejectRefs: []};
  value.proof = {status: "pending", evidence: []};
  assert.ok(validateDesignRequest(value, "2026-08-23-example.request.json").some((failure) => failure.includes("source-first")));
});

test("refuses to resolve without authority, source and proof", () => {
  const value = {...openRequest(), status: "resolved"};
  value.implementation = {status: "pending", paths: [], rejectRefs: []};
  value.proof = {status: "pending", evidence: []};
  const failures = validateDesignRequest(value, "2026-08-23-example.request.json");
  assert.ok(failures.some((failure) => failure.includes("authority disposition")));
  assert.ok(failures.some((failure) => failure.includes("applied implementation")));
  assert.ok(failures.some((failure) => failure.includes("passing proof")));
});

test("reject table points at an existing request and preserves failed source evidence", () => {
  const table = {schemaVersion: 1, rejects: [{
    id: "reject-example-one",
    requestId: "2026-08-23-example",
    rejectedOn: "2026-08-23",
    reason: "The source attempt kept the ambiguous meaning.",
    sourcePaths: ["src/example.tsx"],
    evidence: ["browser-proof:failed-example"],
  }]};
  assert.deepEqual(validateRejectsTable(table, new Set(["2026-08-23-example"])), []);
  const request = openRequest();
  request.implementation.rejectRefs = ["reject-example-one"];
  assert.deepEqual(validateRejectLinks([request], table), []);
  request.implementation.rejectRefs = [];
  assert.ok(validateRejectLinks([request], table).some((failure) => failure.includes("owning request")));
});
