import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { openSession, confirmSession, discoveryFor, answerFor, cleanupFixtureOwners } from './v23-test-fixture.mjs';
import { openAttempt } from './attempt-gate.mjs';
import { acquireWorkerSlot, releaseWorkerSlot } from './worker-slots.mjs';
import { buildEvidenceManifest } from './evidence-manifest.mjs';
import { retainSessionBundle } from './session-cleanup.mjs';
import { validateSession } from './validate-session.mjs';
import { validateResponse } from './validate-response.mjs';
import { loadEnvironmentSchema, stackDeclaration } from './validate-request.mjs';
import { expectedCheckIds, authorizationClasses } from '../operators/environment-preflight/validate.mjs';
import { playwrightInstallOf } from './browser-walk.mjs';
import { workflowPeerSnapshotErrors, buildWorkflowVerification, workflowReportErrors, WORKFLOW_PEERS, WORKFLOW_REPORT } from './workflow-verification.mjs';
import { validateWorkflowStep } from '../operators/workflow-verify/validate.mjs';
import { validateStep } from './validate-step.mjs';
import { mutateSession } from './session-lock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const put = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); };
const now = () => new Date().toISOString();

async function fixture(run) {
  const host = mkdtempSync(path.join(tmpdir(), 'starci-workflow-proof-'));
  const root = path.join(host, '.claude');
  symlinkSync(ROOT, root, process.platform === 'win32' ? 'junction' : 'dir');
  const sessions = path.join(host, '.worktrees', 'sessions');
  const doneWhen = 'Every independently owned outcome is proven at its recorded head';
  const children = [];
  put(path.join(host, '.stacks/test/environment.json'), { schemaVersion: 9, env: 'test', production: false, services: [], authorization: {} });
  const install = playwrightInstallOf(host, root);
  put(install.module, { name: 'playwright', version: '0.0.0-synthetic' });
  mkdirSync(path.join(install.browsers, 'chromium-0000'), { recursive: true });
  const declaration = await stackDeclaration(root, 'test', host);
  const classes = authorizationClasses(await loadEnvironmentSchema(root));
  const reportSchema = read(path.join(root, 'templates/kinds/readiness-report.schema.json'));
  async function session(id, operator, mode = 'solo') {
    const worktree = path.join(host, id); mkdirSync(worktree);
    const opened = await openSession(sessions, { sessionId: id, project: 'fixture', topology: { mode }, hostBinding: { kind: 'codex-task', hostId: `task-${id}`, worktree, sourcePromptRef: 'user:fixture' },
      mission: { language: 'en', goal: 'Verify the declared outcome', target: 'synthetic proof', includes: ['proof'], excludes: ['product work'], outputs: ['accepted report'],
        doneWhen: [{ evidence: doneWhen, producedBy: operator }], verification: 'Synthetic accepted-evidence fixture, not a live product run.', sourceRef: 'user:fixture' } });
    await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:fixture' });
    const branch = path.join(opened.session, 'step-1', 'parallel-1');
    const state = read(path.join(opened.session, 'state.json'));
    state.chain = [['1/1']]; state.steps = { '1/1': operator }; state.current = '1/1';
    const request = { contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: operator, sessionId: id, step: 1, parallel: 1, contexts: [], requirements: {}, inputs: {}, resume: null, goal: { doneWhen: 0 },
      attempt: { id: `${id}-a1`, number: 1, kind: 'initial', previous: null },
      expected: { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [{ id: 'proven', required: true, expected: doneWhen, verification: 'Validate the report against retained actual evidence' }] },
      environment: { isolationId: `${id}-a1`, mode: 'inline', workspace: null, reads: [], writes: [], exclusive: [], outputRoot: path.join(branch, 'response') }, frozenInputs: [] };
    return { ...opened, state, branch, request, stateFile: path.join(opened.session, 'state.json') };
  }
  const finish = async (item, fields, primary, commits = []) => {
    const evidence = Object.values(fields);
    const response = { contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: item.request.operatorId, step: 1, parallel: 1, status: 'done', boundProfile: 'sol-reviewer', ranProfile: 'sol-reviewer',
      fields, commits, fallbacks: [], next: [], attempt: { id: item.request.attempt.id, number: 1, expectedVersion: 1 }, goalCheck: { achieved: true, evidence },
      outcome: { summary: 'Synthetic accepted proof is available', primary },
      actual: { expectedVersion: 1, observedAt: now(), observations: [{ criterionId: 'proven', observed: doneWhen, evidence }] },
      comparison: { expectedVersion: 1, verdict: 'matched', criteria: [{ criterionId: 'proven', verdict: 'matched', note: 'Evidence was observed', evidence }], next: 'advance' } };
    put(path.join(item.branch, 'response/response.json'), response);
    assert.deepEqual((await validateResponse(root, item.branch)).errors, []);
    const state = read(item.stateFile);
    Object.assign(state.attempts['1/1'], { status: 'matched', responseRef: 'step-1/parallel-1/response/response.json', endedAt: now(), comparison: response.comparison, evidenceManifest: await buildEvidenceManifest(item.branch) });
    state.status = 'done'; state.brief.proven = ['doneWhen:0 accepted fixture evidence'];
    put(item.stateFile, state); item.state = state;
    return response;
  };
  try {
    for (const id of ['first', 'second']) {
      const child = await session(id, 'environment.preflight');
      const worktree = child.state.hostBinding.worktree;
      const git = args => execFileSync('git', ['-C', worktree, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      git(['init', '-q']); git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', `Synthetic ${id} proof`]);
      child.head = git(['rev-parse', 'HEAD']);
      child.request.environment.workspace = { alias: '@workspaces/be', worktree, revision: child.head };
      child.request.requirements = { project: 'fixture', roles: ['fixture'], runtimeRoles: [] };
      put(child.stateFile, child.state); put(path.join(child.branch, 'request/request.json'), child.request);
      await openAttempt(child.branch);
      put(path.join(child.branch, 'response/response.md'), '# environment-readiness — fixture\n\n## Binding\n\n| Field | Value |\n| --- | --- |\n| Project | fixture |\n| Roles | fixture |\n| Environment | test |\n| Flow | — |\n| Declaration | — |\n\n## Checks\n\n| Check | Family | Status | Evidence |\n| --- | --- | --- | --- |\n| `host.browser` | host | ok | Synthetic accepted original observation |\n\n## Walls\n\n| Wall | Owner | Repair |\n| --- | --- | --- |\n\n## Fallbacks taken\n\n| Code | Action |\n| --- | --- |\n');
      const checks = expectedCheckIds(reportSchema, ['fixture'], classes).map(checkId => ({
        id: checkId, family: checkId.split('.')[0], status: /^(identity\.flow\.|runtime\.)/.test(checkId) ? 'skipped' : 'ok',
        evidence: checkId.startsWith('approval.') ? `${declaration.authorization[checkId.slice('approval.'.length)]}, synthetic declared observation` : 'Synthetic original observation', owner: null
      }));
      put(path.join(child.branch, 'response/data/readiness-report.json'), { project: 'fixture', roles: ['fixture'], env: 'test', flow: null, declarationRef: declaration.reference, generatedAt: now(), checks, walls: [] });
      const receipt = readFileSync(path.join(child.branch, 'response/response.md'), 'utf8')
        .replace('| Declaration | — |', `| Declaration | ${declaration.reference} |`)
        .replace('| `host.browser` | host | ok | Synthetic accepted original observation |', checks.map(check => `| \`${check.id}\` | ${check.family} | ${check.status} | ${check.evidence} |`).join('\n'));
      put(path.join(child.branch, 'response/response.md'), receipt);
      await finish(child, { 'environment-readiness': 'response/response.md', 'readiness-report': 'response/data/readiness-report.json' }, { kind: 'document', label: 'Readiness', ref: 'response/response.md' }, [child.head]);
      assert.deepEqual((await validateSession(root, child.session)).errors, []);
      children.push(child);
    }
    const parent = await session('coordinator', 'workflow.verify', 'coordinated');
    parent.request.environment.mode = 'isolated';
    parent.request.contexts = children.flatMap(child => ['sessions', 'done'].map(zone => ({ alias: `@worktrees/${zone}/${child.sessionId}`, head: null })));
    parent.request.environment.reads = parent.request.contexts.map(context => context.alias);
    const peers = Object.fromEntries(children.map(child => [child.state.hostBinding.hostId, { owns: child.sessionId, head: child.head }]));
    parent.state.brief.peers = peers;
    parent.request.requirements = { peers: WORKFLOW_PEERS };
    const snapshot = { version: 1, peers: Object.fromEntries(children.map(child => [child.state.hostBinding.hostId, { ...peers[child.state.hostBinding.hostId], sessionId: child.sessionId, goal: child.state.mission.goal, doneWhen: [doneWhen] }])) };
    put(path.join(parent.branch, WORKFLOW_PEERS), snapshot);
    parent.request.frozenInputs = [{ ref: WORKFLOW_PEERS, sha256: sha(readFileSync(path.join(parent.branch, WORKFLOW_PEERS))) }];
    put(parent.stateFile, parent.state); put(path.join(parent.branch, 'request/request.json'), parent.request);
    await openAttempt(parent.branch);
    parent.state = read(parent.stateFile);
    await run({ host, root, children, parent, snapshot, doneWhen, finish });
  } finally { cleanupFixtureOwners(host); rmSync(host, { recursive: true, force: true }); }
}

test('ordinary-message coordination closes only with a verified local receipt, without imports', async () => fixture(async ({ root, parent, children, finish }) => {
  const built = await buildWorkflowVerification(root, parent.branch, parent.request, parent.state);
  assert.deepEqual(built.errors, []);
  put(path.join(parent.branch, WORKFLOW_REPORT), built.report);
  await finish(parent, { 'workflow-verification-report': WORKFLOW_REPORT }, { kind: 'table', label: 'Verified outcomes', ref: WORKFLOW_REPORT });
  assert.deepEqual((await validateWorkflowStep(parent.branch, root)).errors, []);
  assert.deepEqual((await validateSession(root, parent.session)).errors, []);
  assert.ok(children.every(child => existsSync(child.session)), 'verification edits or imports no child');
  const archive = await retainSessionBundle(parent.session, parent.state, 'Synthetic coordinated goal verified');
  assert.ok(existsSync(path.join(archive.bundle, 'step-1/parallel-1', WORKFLOW_PEERS)));
  assert.deepEqual((await validateSession(root, archive.bundle)).errors, []);
}));

test('a differently profiled coordinator leases a same-session verifier worker without changing its host', async () => fixture(async ({ parent, root }) => {
  const manifest = read(path.join(root, 'operators/workflow-verify/operator.json'));
  assert.equal(manifest.resources.mode, 'isolated');
  const originalHost = structuredClone(parent.state.hostBinding);
  const worker = await acquireWorkerSlot(parent.branch, 'portfolio-proof-worker', { ranProfile: manifest.resources.profile });
  assert.equal(worker.status, 'acquired');
  const state = read(parent.stateFile);
  assert.deepEqual(state.hostBinding, originalHost);
  assert.equal(state.workerSlots.length, 1);
  assert.equal(state.steps['1/1'], 'workflow.verify');
  await releaseWorkerSlot(parent.session, worker.token);
  const noContext = structuredClone(parent.request); noContext.contexts = [];
  assert.ok(workflowPeerSnapshotErrors(root, parent.branch, noContext, parent.state).some(error => error.includes('explicit original session or archive context')));
  for (const alias of ['@worktrees/sessions', '@worktrees/sessions/untracked-peer', '@worktrees/done/untracked-peer', `${parent.request.contexts[0].alias}/state.json`]) {
    const outside = structuredClone(parent.request); outside.contexts.push({ alias, head: null });
    assert.ok(workflowPeerSnapshotErrors(root, parent.branch, outside, parent.state).some(error => error.includes('not an exact live or retained root of a frozen peer')), alias);
  }
  const duplicate = structuredClone(parent.request); duplicate.contexts.push(structuredClone(duplicate.contexts[0]));
  assert.ok(workflowPeerSnapshotErrors(root, parent.branch, duplicate, parent.state).some(error => error.includes('is duplicated')));
}));

test('heads and narrated success alone cannot close a coordinated mission', async () => fixture(async ({ root, parent }) => {
  parent.state.status = 'done'; parent.state.brief.proven = ['doneWhen:0 all peers said done'];
  put(parent.stateFile, parent.state);
  const checked = await validateSession(root, parent.session);
  assert.ok(checked.errors.some(error => error.includes('matched local verifier receipt')));
  assert.ok(checked.errors.some(error => error.includes('not backed by a matched v2.2 attempt')));
}));

test('peer snapshot rejects changed ownership, missing coverage, duplicate identity and unsafe paths', async () => fixture(async ({ root, parent, snapshot }) => {
  for (const mutate of [
    snap => { snap.peers['task-first'].owns = 'unowned'; },
    snap => { snap.peers['task-first'].head = 'f'.repeat(40); },
    snap => { snap.peers['task-second'].sessionId = 'first'; },
    snap => { snap.peers['task-first'].sessionId = '../escape'; },
    snap => { delete snap.peers['task-second']; },
    snap => { for (const peer of Object.values(snap.peers)) peer.doneWhen = ['a different goal']; }
  ]) {
    const changed = structuredClone(snapshot); mutate(changed);
    put(path.join(parent.branch, WORKFLOW_PEERS), changed);
    const request = structuredClone(parent.request); request.frozenInputs[0].sha256 = sha(readFileSync(path.join(parent.branch, WORKFLOW_PEERS)));
    assert.ok(workflowPeerSnapshotErrors(root, parent.branch, request, parent.state).length);
  }
}));

test('unfinished peers, altered proof, wrong task binding and unproven heads are refused', async () => fixture(async ({ root, parent, children }) => {
  const first = children[0];
  for (const mutate of [
    state => { state.status = 'running'; },
    state => { state.hostBinding.hostId = 'other-task'; },
    state => { state.brief.blocked.push({ what: 'unresolved', owner: 'person', since: now() }); },
    state => { state.topology.mode = 'coordinated'; },
    state => { state.brief.proven = []; }
  ]) {
    const changed = structuredClone(first.state); mutate(changed); put(first.stateFile, changed);
    assert.ok((await buildWorkflowVerification(root, parent.branch, parent.request, parent.state)).errors.length);
  }
  put(first.stateFile, first.state);
  const reportFile = path.join(first.branch, 'response/data/readiness-report.json');
  const original = readFileSync(reportFile, 'utf8'); put(reportFile, original + '\n');
  assert.ok((await buildWorkflowVerification(root, parent.branch, parent.request, parent.state)).errors.some(error => /changed after acceptance/.test(error)));
  put(reportFile, original);
  const changed = read(path.join(parent.branch, WORKFLOW_PEERS)); changed.peers['task-first'].head = 'f'.repeat(40);
  put(path.join(parent.branch, WORKFLOW_PEERS), changed); parent.request.frozenInputs[0].sha256 = sha(readFileSync(path.join(parent.branch, WORKFLOW_PEERS)));
  parent.state.brief.peers['task-first'].head = changed.peers['task-first'].head;
  assert.ok((await buildWorkflowVerification(root, parent.branch, parent.request, parent.state)).errors.some(error => /not bound by the accepted proving branch/.test(error)));
}));

test('retained originals remain verifiable and forged portfolio reports are rejected', async () => fixture(async ({ root, parent, children }) => {
  for (const child of children) {
    await retainSessionBundle(child.session, child.state, 'Synthetic accepted child');
    renameSync(child.session, `${child.session}-retained-test-source`);
  }
  const built = await buildWorkflowVerification(root, parent.branch, parent.request, parent.state);
  assert.deepEqual(built.errors, []);
  put(path.join(parent.branch, WORKFLOW_REPORT), built.report);
  assert.deepEqual(await workflowReportErrors(root, parent.branch, parent.request, parent.state), []);
  built.report.peers[0].stateHash = `sha256:${'0'.repeat(64)}`;
  put(path.join(parent.branch, WORKFLOW_REPORT), built.report);
  assert.ok((await workflowReportErrors(root, parent.branch, parent.request, parent.state)).some(error => /differs from the original/.test(error)));
}));

test('a sealed but semantically invalid child receipt cannot prove a peer', async () => fixture(async ({ root, parent, children }) => {
  const child = children[0];
  const reportFile = path.join(child.branch, 'response/data/readiness-report.json');
  const report = read(reportFile);
  report.checks = report.checks.filter(check => check.id === 'host.browser');
  put(reportFile, report);
  // Even a ledger that claims new acceptance cannot bypass the original operator's own law.
  child.state.attempts['1/1'].evidenceManifest = await buildEvidenceManifest(child.branch);
  put(child.stateFile, child.state);
  const result = await buildWorkflowVerification(root, parent.branch, parent.request, parent.state);
  assert.ok(result.errors.some(error => error.includes('was not run')));
}));

test('a head shaped like an OID is not proof unless it resolves to the actual source HEAD', async () => fixture(async ({ root, parent, children }) => {
  const child = children[0];
  const responseFile = path.join(child.branch, 'response/response.json');
  const response = read(responseFile); response.commits = ['f'.repeat(40)]; put(responseFile, response);
  child.state.attempts['1/1'].evidenceManifest = await buildEvidenceManifest(child.branch); put(child.stateFile, child.state);
  const snapshotFile = path.join(parent.branch, WORKFLOW_PEERS);
  const snapshot = read(snapshotFile); snapshot.peers['task-first'].head = 'f'.repeat(40); put(snapshotFile, snapshot);
  parent.state.brief.peers['task-first'].head = 'f'.repeat(40);
  parent.request.frozenInputs[0].sha256 = sha(readFileSync(snapshotFile));
  assert.ok((await buildWorkflowVerification(root, parent.branch, parent.request, parent.state)).errors.length);
}));
