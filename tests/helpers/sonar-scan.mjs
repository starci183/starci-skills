// The green proofs a fixture that settles an op attaches: the sonar-local scan summary (knowledge/sonar-gate.yaml
// enforcedOps), the op loop's gate.json and read-digest.json (knowledge/op-gate.yaml enforcedOps) and the mechanism proofs of
// knowledge/op-gate.yaml opProofs (the document gate, the test-world and unit run summaries, the starci app lint report, the review
// defect classes and the release proof). The settle reads what
// the op attached and refuses a pass without them. These fixtures test other behaviour, so what they attach is the honest
// "slice meets the gate, READ done" record.
import fs from 'node:fs';
import path from 'node:path';
import { loadSonarGate, thresholdsOf } from '../../scripts/gates/sonar-gate.mjs';
import { GATE_SCHEMA } from '../../scripts/gates/gate.mjs';
import { DIGEST_SCHEMA } from '../../scripts/gates/read-digest.mjs';
import { TEST_WORLD_RUN_SCHEMA } from '../../scripts/gates/test-world-run.mjs';
import { UNIT_RUN_SCHEMA } from '../../scripts/gates/unit-run.mjs';
import { RELEASE_PROOF_SCHEMA, RELEASE_STEPS } from '../../scripts/gates/release-proof.mjs';
import { REVIEW_DEFECTS_SCHEMA, SECURITY_FINDINGS_SCHEMA } from '../../scripts/kernel/gate-settle.mjs';

export const greenSonarScan = () => ({
  schema: 'starci/sonar-local-scan@3', at: new Date().toISOString(), scope: 'slice', outcome: 'pass',
  gate: thresholdsOf(loadSonarGate()), slice: { verdict: 'pass', failures: [] },
});

export const greenGate = () => ({ schema: GATE_SCHEMA, at: new Date().toISOString(), root: '.', base: null, head: null, changed: [], exit: 0, ok: true,
  steps: {}, counts: { new: 0, preexisting: 0 }, findings: [], errors: [] });
export const greenReadDigest = () => ({ schema: DIGEST_SCHEMA, at: new Date().toISOString(), root: '.', touched: [], slotMap: [],
  files: [{ path: 'knowledge/patterns/be/service.yaml', role: 'pattern', sha256: 'a'.repeat(64) }] });

const at = () => new Date().toISOString();
export const greenDocGate = () => ({ ...greenGate(), profile: 'docs', steps: { docs: [] } });
export const greenTestWorldRun = (project = 'e2e') => ({ schema: TEST_WORLD_RUN_SCHEMA, at: at(), root: '.', project, tests: null,
  harness: { jestConfig: 'be/jest.config.js', preset: true, declaration: 'be/src/tests/world/test-world.config.ts', defineTestWorld: true },
  specs: [{ path: `be/src/tests/${project}/a.${project}-spec.ts`, useTestWorld: true, modes: ['apps', 'modules', 'sandbox'], outage: 0, forbidden: [] }], outageCalls: 0,
  run: { command: `npm run test:${project} -- --json`, exit: 0, total: 1, passed: 1, failed: 0, skipped: 0, files: 1, failedFiles: 0, failures: [], error: null }, findings: [], exit: 0 });
export const greenUnitRun = () => ({ schema: UNIT_RUN_SCHEMA, at: at(), root: '.',
  run: { command: 'npm test -- --json', exit: 0, total: 1, passed: 1, failed: 0, skipped: 0, files: 1, failedFiles: 0, failures: [], error: null }, services: [], findings: [], exit: 0 });
export const greenLint = () => ({ schema: 'starci/lint@1', findings: [], errors: [] });
export const greenSecurityFindings = () => ({ schema: SECURITY_FINDINGS_SCHEMA, at: at(), findings: [] });
export const greenReviewDefects = () => ({ schema: REVIEW_DEFECTS_SCHEMA, at: at(), defects: [] });
export const greenReleaseProof = () => ({ schema: RELEASE_PROOF_SCHEMA, at: at(), repo: '.', base: 'HEAD~1', ok: true, exit: 0,
  steps: RELEASE_STEPS.map((id) => ({ id, command: id, exit: 0, status: 'pass', detail: '' })) });

/** The file names writeGreenProofs writes, in order. */
export const GREEN_PROOF_FILES = Object.freeze(['sonar.json', 'gate.json', 'read-digest.json', 'doc-gate.json', 'test-world-run.json', 'test-world-integration.json', 'test-world-contract.json', 'unit-run.json', 'lint.json', 'security-findings.json', 'review-defects.json', 'release-proof.json']);
/** Write every green proof into <dir>; their absolute paths, ready for a report's `files`. */
export const writeGreenProofs = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  const docs = [greenSonarScan(), greenGate(), greenReadDigest(), greenDocGate(), greenTestWorldRun('e2e'), greenTestWorldRun('integration'), greenTestWorldRun('contract'), greenUnitRun(), greenLint(), greenSecurityFindings(), greenReviewDefects(), greenReleaseProof()];
  return GREEN_PROOF_FILES.map((name, i) => { const file = path.join(dir, name); fs.writeFileSync(file, JSON.stringify(docs[i])); return file; });
};
