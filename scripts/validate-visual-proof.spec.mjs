import assert from "node:assert/strict";
import test from "node:test";
import {validateVisualProof} from "./validate-visual-proof.mjs";

const baseline = {references: [{id: "desktop-ready", state: "ready", viewport: {width: 1440, height: 900}}]};
const proof = () => ({
  schemaVersion: 2, candidateAt: "a".repeat(64), renderContractId: "lesson-render",
  requestedTerminalState: "committed", actualTerminalState: "committed", knownDefects: [],
  checks: {build: "passed", lint: "passed", tests: "passed", browser: "passed"},
  comparisons: [{referenceId: "desktop-ready", state: "ready", viewport: {width: 1440, height: 900}, previewCapture: "captures/preview-desktop-ready.png", sourceCapture: "captures/source-desktop-ready.png", fullViewport: "passed", targetRegion: "passed", preservedRegions: "passed", parity: "passed", mismatches: [], consoleClean: true}]
});

test("same-viewport full-page proof reaches the requested delivery state", () => assert.equal(validateVisualProof(baseline, proof()).ok, true));
test("computed target proof without full viewport parity is rejected", () => { const value = proof(); value.comparisons[0].fullViewport = "missing"; assert.match(validateVisualProof(baseline, value).failures.join("\n"), /incomplete/); });
test("known defects and an uncommitted delivery cannot be called complete", () => { const value = proof(); value.knownDefects = ["mobile overflow"]; value.actualTerminalState = "verified-local"; assert.match(validateVisualProof(baseline, value).failures.join("\n"), /known visual defects|delivery stopped/); });
test("text-only proof without distinct real captures is rejected", () => { const value = proof(); value.comparisons[0].previewCapture = "passed"; value.comparisons[0].sourceCapture = "passed"; assert.match(validateVisualProof(baseline, value).failures.join("\n"), /distinct real preview\/source captures/); });
test("parity requires an explicit empty mismatch list", () => { const value = proof(); value.comparisons[0].mismatches = ["page title scale differs"]; assert.match(validateVisualProof(baseline, value).failures.join("\n"), /incomplete/); });
test("proof binds the selected candidate and render contract", () => { const value = proof(); delete value.candidateAt; delete value.renderContractId; assert.match(validateVisualProof(baseline, value).failures.join("\n"), /candidateAt|renderContractId/); });
