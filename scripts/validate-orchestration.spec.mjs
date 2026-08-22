import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {canonicalHash, validateProfiles, validateReceipt, validateWorkspace} from "./validate-orchestration.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profiles = () => JSON.parse(fs.readFileSync(path.join(root, "orchestration", "profiles.json"), "utf8"));
const hash = "a".repeat(64);
const boundaryHash = "b".repeat(64);
const decisions = ["journey-decision", "ui-direction", "state-ownership", "approval", "claude-authority", "shared-integration", "final-verdict"];

const receipt = () => {
  const impactCone = {owners: [{id: "page", path: "src/Page.tsx"}], consumers: ["src/Page.tsx"], tests: [], requiredPaths: ["src/Page.tsx"], inventoryProof: ["source-owner matrix at boundary hash"]};
  const impactConeAt = canonicalHash(impactCone);
  return ({
  schemaVersion: 3,
  status: "planned",
  runtime: "codex",
  skill: "starci-fe-design-layout",
  envelopeAt: hash,
  impact: {level: "page", workflow: "layout", classificationAt: hash},
  coordinator: {id: "coordinator", model: "gpt-5.6-sol", owns: decisions},
  phaseGates: {authorityMode: "preserve", approvalMode: "manual", cacheRoots: ["review"], frozenContractAt: hash, qualityReviewAt: boundaryHash, sourceBoundaryAt: boundaryHash, sourceApprovalAt: `OK #2:${boundaryHash}`, approvedSourcePaths: ["src/Page.tsx"], impactConeAt, impactCone, proofRoots: ["proof"]},
  gateEvents: [
    {id: "pages-frozen", kind: "contract-freeze", at: hash, status: "passed", dependsOn: [], requiredArtifacts: []},
    {id: "quality-passed", kind: "quality-review", at: boundaryHash, status: "passed", dependsOn: ["pages-frozen"], requiredArtifacts: []},
    {id: "impact-locked", kind: "impact-cone", at: impactConeAt, status: "passed", dependsOn: ["quality-passed"], requiredArtifacts: []},
    {id: "source-approved", kind: "source-approval", at: `OK #2:${boundaryHash}`, status: "passed", dependsOn: ["impact-locked"], requiredArtifacts: ["complete HTML"]}
  ],
  challenges: [],
  tasks: [
    {id: "render-pages", skill: "starci-fe-design-layout", envelopeAt: hash, step: "page-synthesis", kind: "cache-write", model: "gpt-5.6-luna", objective: "Render the frozen page contract exactly.", requiredInputs: ["pages.json", "quality-review.json"], dependsOn: [], dependsOnGates: ["pages-frozen", "quality-passed"], reads: ["pages.json", "quality-review.json"], writes: ["review/index.html"], frozenContractAt: hash, qualityReviewAt: boundaryHash, forbiddenDecisions: decisions, output: "complete HTML", outputConsumers: ["gate:source-approved"], requiredProof: ["desktop and narrow captures"], stopConditions: ["contract drift"]},
    {id: "code-page", skill: "starci-fe-design-layout", envelopeAt: hash, step: "implementation", kind: "source-write", model: "gpt-5.6-luna", objective: "Implement the approved render contract exactly.", requiredInputs: ["render-contract.json"], dependsOn: ["render-pages"], dependsOnGates: ["source-approved", "impact-locked"], reads: ["render-contract.json"], writes: ["src/Page.tsx"], sourceApprovalAt: `OK #2:${boundaryHash}`, forbiddenDecisions: decisions, output: "page diff", outputConsumers: ["delivery"], requiredProof: ["targeted tests"], stopConditions: ["outside boundary"]}
  ],
  batches: [["render-pages"], ["code-page"]],
  results: [],
  sharedPaths: [".claude/context-manifest.json"],
  sequentialFallback: {owner: "coordinator", order: ["render-pages", "code-page"], preservesDependencies: true, preservesWriterRegistry: true}
  });
};

test("published profiles and all three skill maps are valid", () => {
  assert.equal(validateProfiles(profiles()).ok, true);
  assert.deepEqual(validateWorkspace(root), {ok: true, failures: []});
  const schema = JSON.parse(fs.readFileSync(path.join(root, "orchestration", "receipt.schema.json"), "utf8"));
  assert.equal(schema.properties.schemaVersion.const, 3);
  assert.ok(schema.required.includes("impact"));
  assert.ok(schema.required.includes("challenges"));
});

test("a frozen HTML task followed by approved disjoint source is valid", () => assert.equal(validateReceipt(receipt(), profiles()).ok, true));

test("two workers may not write one path", () => {
  const value = receipt();
  value.tasks[1].writes = ["review/index.html"];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /overlaps writer path/);
});

test("an intermediate artifact without a downstream consumer is rejected", () => {
  const value = receipt();
  value.tasks[0].outputConsumers = [];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /no declared consumer/);
});

test("directory and descendant file writers overlap", () => {
  const value = receipt();
  value.tasks[0].writes = ["src"];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /overlaps writer path/);
});

test("cache HTML without a frozen decision contract is rejected", () => {
  const value = receipt();
  delete value.tasks[0].frozenContractAt;
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /without the passed coordinator freeze gate/);
});

test("copying a frozen hash without depending on its passed gate is rejected", () => {
  const value = receipt();
  value.tasks[0].dependsOnGates = [];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /without the passed coordinator freeze gate/);
});

test("cache HTML requires a passed target-matched integrated quality-review gate", () => {
  const value = receipt();
  value.tasks[0].dependsOnGates = ["pages-frozen"];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /without the passed integrated quality-review gate/);
});

test("source work without its proportional exact approval is rejected", () => {
  const value = receipt();
  delete value.tasks[1].sourceApprovalAt;
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /without the proportional approval/);
});

test("component impact uses one exact source approval", () => {
  const value = receipt();
  value.skill = "starci-fe-design-block";
  value.impact = {level: "component", workflow: "block", classificationAt: hash};
  value.phaseGates.sourceApprovalAt = `OK #1:${boundaryHash}`;
  value.gateEvents[3].at = value.phaseGates.sourceApprovalAt;
  value.tasks[0].skill = value.skill; value.tasks[0].step = "direction";
  value.tasks[1].skill = value.skill; value.tasks[1].step = "implement"; value.tasks[1].sourceApprovalAt = value.phaseGates.sourceApprovalAt;
  assert.equal(validateReceipt(value, profiles()).ok, true);
});

test("auto approval binds source work to both invocation authority and exact boundary", () => {
  const value = receipt();
  value.phaseGates.approvalMode = "auto";
  value.phaseGates.autoApprovalAt = hash;
  value.phaseGates.sourceApprovalAt = `AUTO:${hash}:OK #2:${boundaryHash}`;
  value.gateEvents[3].at = value.phaseGates.sourceApprovalAt;
  value.tasks[1].sourceApprovalAt = value.phaseGates.sourceApprovalAt;
  assert.equal(validateReceipt(value, profiles()).ok, true);
  value.tasks[1].sourceApprovalAt = `AUTO:${boundaryHash}:OK #2:${boundaryHash}`;
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /without the proportional approval/);
});

test("auto approval cannot be inferred without an immutable opt-in hash", () => {
  const value = receipt();
  value.phaseGates.approvalMode = "auto";
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /immutable invocation envelope hash/);
  value.phaseGates.autoApprovalAt = boundaryHash;
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /immutable invocation envelope hash/);
});

test("high-risk work requires a blind independent reviewer and a resolved challenge gate", () => {
  const value = receipt();
  value.impact = {level: "capability", workflow: "full", classificationAt: hash};
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /independent reviewer|challenge-review/);
  value.challenges = [{id: "contract-risk", raisedBy: "reviewer", claim: "The new contract omits a permission refusal path.", evidence: ["review:permission-state"], status: "resolved", resolutionEvidence: ["contract:test-forbidden"]}];
  value.independentReview = {reviewerId: "reviewer", model: "gpt-5.6-sol", blindToRecommendation: true, mayWrite: false, status: "passed", challengeIds: ["contract-risk"]};
  value.gateEvents.push({id: "reviewer-passed", kind: "challenge-review", at: "reviewer", status: "passed", dependsOn: ["quality-passed"], requiredArtifacts: []});
  value.tasks[1].dependsOnGates.push("reviewer-passed");
  assert.equal(validateReceipt(value, profiles()).ok, true);
});

test("a worker missing a forbidden coordinator decision is rejected", () => {
  const value = receipt();
  value.tasks[0].forbiddenDecisions = decisions.filter((item) => item !== "ui-direction");
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /may accidentally own ui-direction/);
});

test("cycles and omitted batch tasks are rejected", () => {
  const value = receipt();
  value.tasks[0].dependsOn = ["code-page"];
  value.batches = [["render-pages"]];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /dependency cycle|omitted from execution batches/);
});

test("sequential fallback must preserve dependency order", () => {
  const value = receipt();
  value.sequentialFallback.order = ["code-page", "render-pages"];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /sequential fallback orders/);
});

test("a task step must belong to the selected skill map", () => {
  const value = receipt();
  value.tasks[0].step = "direction";
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /uses invalid step/);
});

test("source assignment must cover the exact approved impact cone", () => {
  const value = receipt();
  value.phaseGates.approvedSourcePaths.push("src/Unassigned.tsx");
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /has no source writer/);
});

test("impact-cone hash must cover the disclosed inventory", () => {
  const value = receipt();
  value.phaseGates.impactCone.consumers.push("src/HiddenConsumer.tsx");
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /stale impact-cone manifest/);
});

test("refactor evolving authority requires compiled authority proof", () => {
  const value = receipt();
  value.skill = "starci-fe-layout-refactor";
  value.tasks[0].skill = value.skill;
  value.tasks[0].step = "direction";
  value.tasks[1].skill = value.skill;
  value.tasks[1].step = "evolve-refactor";
  value.phaseGates.authorityMode = "evolve";
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /before passed compiled authority proof/);
});

test("proof must bind the stable build and depend on every source task", () => {
  const value = receipt();
  value.phaseGates.stableBuildAt = hash;
  value.phaseGates.proofTargetsAt = boundaryHash;
  value.gateEvents.push({id: "build-stable", kind: "stable-build", at: hash, status: "passed", dependsOn: ["source-approved"], requiredArtifacts: []}, {id: "targets-frozen", kind: "proof-targets", at: boundaryHash, status: "passed", dependsOn: ["pages-frozen"], requiredArtifacts: []});
  value.tasks.push({id: "prove-page", skill: value.skill, envelopeAt: hash, step: "parity", kind: "proof", model: "gpt-5.6-luna", objective: "Capture approved parity targets exactly.", requiredInputs: ["stable build"], dependsOn: [], dependsOnGates: ["build-stable", "targets-frozen"], reads: ["src/Page.tsx"], writes: ["proof/visual-proof.json"], stableBuildAt: hash, proofTargetsAt: boundaryHash, forbiddenDecisions: decisions, output: "parity proof", outputConsumers: ["delivery"], requiredProof: ["same-state same-viewport captures"], stopConditions: ["known mismatch"]});
  value.batches.push(["prove-page"]);
  value.sequentialFallback.order.push("prove-page");
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /does not depend on source task/);
});

test("read tasks cannot smuggle source writes", () => {
  const value = receipt();
  value.tasks[0].kind = "read";
  delete value.tasks[0].frozenContractAt;
  value.tasks[0].writes = ["src/Bypass.tsx"];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /read-only but declares writes/);
});

test("cache and proof writes stay inside declared roots", () => {
  const value = receipt();
  value.tasks[0].writes = ["src/FakePreview.tsx"];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /outside declared cacheRoots/);
});

test("path traversal cannot escape a declared cache root", () => {
  const value = receipt();
  value.tasks[0].writes = ["review/../src/FakePreview.tsx"];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /outside declared cacheRoots/);
});

test("Windows writer paths compare case-insensitively", () => {
  const value = receipt();
  value.tasks[0].writes = ["C:\\Repo\\Page.tsx"];
  value.tasks[1].writes = ["c:/repo/page.tsx"];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /overlaps writer path/);
});

test("complete receipts require one clean passing result per task", () => {
  const value = receipt();
  value.status = "complete";
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /missing result/);
});

test("worker results cannot widen an assigned file into its parent directory", () => {
  const value = receipt();
  value.results = [{taskId: "code-page", status: "passed", inputHashes: [hash], observations: [], changedPaths: ["src"], commandsAndProof: ["tests passed"], unresolvedFindings: [], boundaryDrift: false}];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /outside its exact assignment/);
});

test("worker results cannot report descendants of an exact assigned file", () => {
  const value = receipt();
  value.results = [{taskId: "code-page", status: "passed", inputHashes: [hash], observations: [], changedPaths: ["src/Page.tsx", "src/Page.tsx/extra"], commandsAndProof: ["tests passed"], unresolvedFindings: [], boundaryDrift: false}];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /outside its exact assignment/);
});

test("gate dependency cycles are rejected", () => {
  const value = receipt();
  value.gateEvents[0].dependsOn = ["source-approved"];
  assert.match(validateReceipt(value, profiles()).failures.join("\n"), /gate dependency cycle/);
});
