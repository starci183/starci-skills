import assert from "node:assert/strict";
import test from "node:test";
import {validateVisualProof} from "./validate-visual-proof.mjs";

const baseline = {references: [{id: "desktop-ready", state: "ready", viewport: {width: 1440, height: 900}}]};
const proof = () => ({
  requestedTerminalState: "committed", actualTerminalState: "committed", knownDefects: [],
  checks: {build: "passed", lint: "passed", tests: "passed", browser: "passed"},
  comparisons: [{referenceId: "desktop-ready", state: "ready", viewport: {width: 1440, height: 900}, fullViewport: "passed", targetRegion: "passed", preservedRegions: "passed", consoleClean: true}]
});

test("same-viewport full-page proof reaches the requested delivery state", () => assert.equal(validateVisualProof(baseline, proof()).ok, true));
test("computed target proof without full viewport parity is rejected", () => { const value = proof(); value.comparisons[0].fullViewport = "missing"; assert.match(validateVisualProof(baseline, value).failures.join("\n"), /incomplete/); });
test("known defects and an uncommitted delivery cannot be called complete", () => { const value = proof(); value.knownDefects = ["mobile overflow"]; value.actualTerminalState = "verified-local"; assert.match(validateVisualProof(baseline, value).failures.join("\n"), /known visual defects|delivery stopped/); });
