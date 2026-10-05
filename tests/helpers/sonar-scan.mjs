// The green proofs a fixture that settles an op attaches: the sonar-local scan summary (knowledge/sonar-gate.yaml
// enforcedOps), the op loop's gate.json and read-digest.json (knowledge/op-gate.yaml enforcedOps) and the mechanism proofs of
// knowledge/op-gate.yaml opProofs (the document gate, the test-world and unit run summaries, the starci app lint report, the review
// defect classes and the release proof). The settle reads what
// the op attached and refuses a pass without them. These independent lifecycle fixtures use checker outcome doubles;
// the optional admission-bound mode records real current Git inputs and READ hashes, without proving application conformance.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { posixPath, sameResolvedPath } from '../../scripts/lib/path-key.mjs';
import { gateInputSnapshot } from '../../scripts/gates/gate-input.mjs';
import { loadSonarGate, thresholdsOf } from '../../scripts/gates/sonar-gate.mjs';
import { GATE_SCHEMA } from '../../scripts/gates/gate.mjs';
import { DIGEST_SCHEMA, loadOpGate } from '../../scripts/gates/read-digest.mjs';
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
export const writeGreenProofs = (dir, bound = null) => {
  fs.mkdirSync(dir, { recursive: true });
  const docs = [greenSonarScan(), greenGate(), greenReadDigest(), greenDocGate(), greenTestWorldRun('e2e'), greenTestWorldRun('integration'), greenTestWorldRun('contract'), greenUnitRun(), greenLint(), greenSecurityFindings(), greenReviewDefects(), greenReleaseProof()];
  if (bound) {
    const { root, binding, baseRoot = path.resolve(import.meta.dirname, '..', '..') } = bound;
    const target = binding?.targets?.find((row) => sameResolvedPath(row.root, root));
    if (!target?.head || !target.owned?.length) throw new Error('the fixture needs its actual admitted target binding');
    const snapshot = gateInputSnapshot(root, target.head, [], target.owned);
    const doc = loadOpGate({ base: baseRoot });
    const args = [path.join(baseRoot, 'scripts/gates/read-digest.mjs'), '--root', root,
      ...(snapshot.changed.length ? ['--touch', ...snapshot.changed] : []), '--knowledge', ...(doc.digest.required ?? [])];
    const read = spawnSync(process.execPath, args, { cwd: baseRoot, encoding: 'utf8', windowsHide: true,
      timeout: 30000, env: { ...process.env, STARCI_RUNTIME: baseRoot } });
    if (read.status !== 0) throw new Error(`the actual fixture READ producer failed: ${read.stderr || read.stdout}`);
    docs[2] = JSON.parse(read.stdout);
    // These independent lifecycle fixtures retain their checker outcome doubles; only their input/READ custody is real.
    docs[1] = { ...greenGate(), root: posixPath(root), base: snapshot.base, head: snapshot.head,
      changed: snapshot.changed, inputs: snapshot.inputs };
  }
  return GREEN_PROOF_FILES.map((name, i) => { const file = path.join(dir, name); fs.writeFileSync(file, JSON.stringify(docs[i])); return file; });
};

/** A real Git baseline for a private lifecycle fixture; its returned command runner never targets Source. */
export function proofRepo(t, root) {
  const configDir = fs.mkdtempSync(path.join(path.dirname(root), 'proof-git-'));
  t.after(() => fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const config = path.join(configDir, 'global.gitconfig'); fs.writeFileSync(config, '');
  const env = { ...withoutGitLocalEnv(process.env), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: posixPath(config) };
  const git = (...args) => {
    const result = runGit(args, { cwd: root, env, timeout: 30000,
      config: { 'core.hooksPath': path.join(configDir, 'no-hooks'), 'core.fsmonitor': 'false' } });
    if (result.status !== 0 || result.error || result.signal) throw new Error(`private fixture git ${args.join(' ')}: ${result.stderr || result.stdout}`);
    return result.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  for (const [key, value] of [['user.name', 'fixture'], ['user.email', 'fixture@starci.test'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) git('config', key, value);
  fs.writeFileSync(path.join(root, '.gitignore'), '.starciwork/\n');
  fs.writeFileSync(path.join(root, 'fixture.md'), 'private workflow fixture\n');
  git('add', '-A'); git('commit', '-q', '-m', 'private fixture baseline');
  return git;
}
