import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { openSession, confirmSession } from './session-open.mjs';
import { openAttempt } from './attempt-gate.mjs';
import { attemptContractErrors } from './validate-response.mjs';
import { uiKnowledgeRequestErrors, validateRequest, V22_CONTRACT } from './validate-request.mjs';
import { v22SessionErrors } from './validate-session.mjs';
import { acquireHelperSlot, acquireWorkerSlot, normalizeResource, releaseWorkerSlot, resourcesOverlap } from './worker-slots.mjs';
import { mutateSession, withSessionLock } from './session-lock.mjs';
import { withRequestPhase } from './validation-phase.mjs';
import { buildEvidenceManifest } from './evidence-manifest.mjs';
import { validateAgainst } from './json-schema.mjs';

const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const draft = (worktree, hostId = 'codex-task-42') => ({
  project: 'sample',
  hostBinding: { kind: 'codex-task', hostId, worktree, sourcePromptRef: 'user-message:1' },
  mission: {
    language: 'en', goal: 'prove the environment is ready', target: 'sample workspace',
    includes: ['environment readiness'], excludes: ['source changes'], outputs: ['readiness report'],
    doneWhen: [{ evidence: 'readiness is observed', producedBy: 'environment.preflight' }],
    verification: 'The environment report is validated; source behavior is outside this proof.',
    example: null, sourceRef: 'user-message:1'
  }
});

async function fixture(run) {
  const base = path.join(tmpdir(), `starci-v22-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const sessions = path.join(base, '.worktrees', 'sessions');
  const worktree = path.join(base, 'checkout');
  mkdirSync(sessions, { recursive: true });
  mkdirSync(worktree, { recursive: true });
  try { await run({ base, sessions, worktree }); }
  finally { rmSync(base, { recursive: true, force: true }); }
}

test('session opens before confirmation, reuses the host binding, and only explicit as-stated activates it', async () => fixture(async ({ sessions, worktree }) => {
  const opened = await openSession(sessions, draft(worktree));
  const stateFile = path.join(opened.session, 'state.json');
  let state = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(state.contractVersion, V22_CONTRACT);
  assert.equal(state.lifecycle.phase, 'draft');
  assert.equal(state.mission.confirmation.status, 'draft');
  assert.deepEqual(state.chain, []);
  assert.ok(existsSync(path.join(opened.session, 'scope-draft.json')));
  const reused = await openSession(sessions, draft(worktree));
  assert.equal(reused.status, 'reused');
  assert.equal(reused.sessionId, opened.sessionId);
  await assert.rejects(() => confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'agent', sourceRef: 'agent' }), /selectedBy:user/);
  const confirmed = await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user-message:1' });
  assert.equal(confirmed.status, 'confirmed');
  state = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(state.lifecycle.phase, 'active');
  assert.equal(state.mission.confirmation.sourceRef, 'user-message:1');
}));

test('concurrent first prompts create one host session and unsafe explicit ids cannot escape sessions root', async () => fixture(async ({ sessions, worktree }) => {
  const results = await Promise.all([openSession(sessions, draft(worktree)), openSession(sessions, draft(worktree))]);
  assert.equal(new Set(results.map((result) => result.sessionId)).size, 1);
  assert.deepEqual(results.map((result) => result.status).sort(), ['opened', 'reused']);
  await assert.rejects(() => openSession(sessions, { ...draft(worktree, 'another-host'), sessionId: '../escape' }), /safe direct-child/);
}));

test('a session lock waiter never recreates a session removed by its current owner', async () => fixture(async ({ sessions, worktree }) => {
  const opened = await openSession(sessions, draft(worktree));
  let entered;
  let release;
  const inside = new Promise((resolve) => { entered = resolve; });
  const hold = new Promise((resolve) => { release = resolve; });
  const owner = withSessionLock(opened.session, async () => {
    entered();
    await hold;
    rmSync(opened.session, { recursive: true, force: true });
  });
  await inside;
  const waiter = mutateSession(opened.session, async (state) => { state.status = 'blocked'; });
  const rejected = assert.rejects(waiter, /SESSION_MISSING/);
  await new Promise((resolve) => setTimeout(resolve, 30));
  release();
  await owner;
  await rejected;
  assert.equal(existsSync(opened.session), false);
}));

test('attempt gate freezes expected and request artifacts before dispatch; actual comparison covers every criterion', async () => fixture(async ({ sessions, worktree }) => {
  const opened = await openSession(sessions, draft(worktree));
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user-message:1' });
  const branch = path.join(opened.session, 'step-1', 'parallel-1');
  mkdirSync(path.join(branch, 'request'), { recursive: true });
  const manifest = Buffer.from('{"family":"sample"}\n');
  writeFileSync(path.join(branch, 'request', 'knowledge-manifest.json'), manifest);
  const expected = { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [{ id: 'ready', required: true, expected: 'Every declared readiness check passes.', verification: 'Validate the typed readiness report.' }] };
  const request = {
    contractVersion: V22_CONTRACT, schemaVersion: 9, operatorId: 'environment.preflight', step: 1, parallel: 1, sessionId: opened.sessionId,
    contexts: [], requirements: { project: 'sample' }, inputs: {}, resume: null, goal: { doneWhen: 0 },
    attempt: { id: 'preflight-a1', number: 1, kind: 'initial', previous: null }, expected,
    environment: { isolationId: 'preflight-a1', mode: 'inline', workspace: null, reads: [], writes: [], exclusive: [], outputRoot: 'response' },
    frozenInputs: [{ ref: 'request/knowledge-manifest.json', sha256: sha(manifest) }]
  };
  writeFileSync(path.join(branch, 'request', 'request.json'), JSON.stringify(request));
  const stateFile = path.join(opened.session, 'state.json');
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  state.chain = [['1/1']]; state.steps = { '1/1': 'environment.preflight' }; state.current = '1/1';
  writeFileSync(stateFile, JSON.stringify(state));
  const result = await openAttempt(branch);
  assert.equal(result.state, 'opened');
  const frozen = JSON.parse(readFileSync(stateFile, 'utf8')).attempts['1/1'];
  assert.deepEqual(frozen.expected, expected);
  writeFileSync(path.join(branch, 'request', 'knowledge-manifest.json'), '{"family":"changed"}\n');
  assert.ok((await validateRequest(root, branch)).errors.some((error) => error.includes('changed after it was frozen')));
  writeFileSync(path.join(branch, 'request', 'knowledge-manifest.json'), manifest);
  mkdirSync(path.join(branch, 'response'), { recursive: true });
  writeFileSync(path.join(branch, 'response', 'response.md'), '# evidence\n');
  const baseResponse = {
    contractVersion: V22_CONTRACT, schemaVersion: 9, operatorId: 'environment.preflight', step: 1, parallel: 1,
    status: 'done', fields: { evidence: 'response/response.md' }, fallbacks: [], commits: [], next: [],
    attempt: { id: 'preflight-a1', number: 1, expectedVersion: 1 },
    actual: { expectedVersion: 1, observedAt: new Date(Date.now() + 1000).toISOString(), observations: [{ criterionId: 'ready', observed: 'All checks passed.', evidence: ['response/response.md'] }] },
    comparison: { expectedVersion: 1, verdict: 'matched', criteria: [{ criterionId: 'ready', verdict: 'matched', evidence: ['response/response.md'], note: 'The report contains every check.' }], next: 'advance' },
    goalCheck: { achieved: true, evidence: ['response/response.md'] }
  };
  assert.deepEqual(attemptContractErrors(branch, baseResponse, request), []);
  const falseDone = { ...baseResponse, goalCheck: { achieved: false, evidence: [] }, comparison: { ...baseResponse.comparison, verdict: 'mismatched', criteria: [{ ...baseResponse.comparison.criteria[0], verdict: 'mismatched' }], next: 'repair' } };
  assert.ok(attemptContractErrors(branch, falseDone, request).some((error) => error.includes('status done advances only')));
  assert.deepEqual(attemptContractErrors(branch, { ...falseDone, status: 'mismatch' }, request), []);
  writeFileSync(path.join(branch, 'response', 'response.json'), JSON.stringify(baseResponse));
  const evidenceManifest = await buildEvidenceManifest(branch);
  await mutateSession(opened.session, async (fresh) => {
    fresh.attempts['1/1'].status = 'matched';
    fresh.attempts['1/1'].responseRef = 'step-1/parallel-1/response/response.json';
    fresh.attempts['1/1'].endedAt = new Date().toISOString();
    fresh.attempts['1/1'].comparison = baseResponse.comparison;
    fresh.attempts['1/1'].evidenceManifest = evidenceManifest;
    fresh.status = 'done';
    fresh.lifecycle = { ...fresh.lifecycle, phase: 'closed-success', closedAt: new Date().toISOString(), closeReason: 'All done-when criteria matched.', compactRef: '.worktrees/done/session/bundle' };
    fresh.brief.proven = ['doneWhen:0 readiness proof retained'];
  });
  const closed = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.deepEqual(await v22SessionErrors(opened.session, closed), []);
  baseResponse.actual.observations[0].evidence = [];
  writeFileSync(path.join(branch, 'response', 'response.json'), JSON.stringify(baseResponse));
  const tampered = await v22SessionErrors(opened.session, closed);
  assert.ok(tampered.some((error) => error.includes('response/response.json changed after acceptance')));
  assert.ok(tampered.some((error) => error.includes('not backed by a matched v2.2 attempt')));
}));

test('one atomic session gate caps concurrent workers at three, prevents duplicate owners, and detects parent-child resource conflicts', async () => fixture(async ({ sessions, worktree }) => {
  const opened = await openSession(sessions, draft(worktree));
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user-message:1' });
  const stateFile = path.join(opened.session, 'state.json');
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  state.chain = [['1/1'], ['2/1'], ['3/1'], ['4/1'], ['5/1']];
  state.steps = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`${n}/1`, 'environment.preflight']));
  state.budget.maxSameOperator = 5;
  writeFileSync(stateFile, JSON.stringify(state));
  for (const n of [1, 2, 3, 4, 5]) {
    const branch = path.join(opened.session, `step-${n}`, 'parallel-1');
    mkdirSync(path.join(branch, 'request'), { recursive: true });
    const exclusive = n === 5 ? path.join(worktree, 'resource-2', 'child') : path.join(worktree, `resource-${n}`);
    const request = { contractVersion: V22_CONTRACT, schemaVersion: 9, operatorId: 'environment.preflight', step: n, parallel: 1, sessionId: opened.sessionId, contexts: [], requirements: { project: 'sample' }, inputs: {}, resume: null, goal: { doneWhen: 0 }, attempt: { id: `a${n}`, number: 1, kind: 'initial', previous: null }, expected: { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [{ id: 'ready', required: true, expected: 'ready', verification: 'receipt' }] }, environment: { isolationId: `a${n}`, mode: 'inline', workspace: null, reads: [], writes: [], exclusive: [exclusive], outputRoot: 'response' }, frozenInputs: [] };
    writeFileSync(path.join(branch, 'request', 'request.json'), JSON.stringify(request));
    await openAttempt(branch);
  }
  const branches = [1, 2, 3, 4, 5].map((n) => path.join(opened.session, `step-${n}`, 'parallel-1'));
  await assert.rejects(() => acquireWorkerSlot(branches[0], 'worker-without-profile'), /ranProfile is required/);
  const firstWave = await Promise.all(branches.slice(0, 3).map((branch, index) => acquireWorkerSlot(branch, `worker-${index + 1}`, { ranProfile: 'sol-reviewer' })));
  const results = [...firstWave, await acquireWorkerSlot(branches[3], 'worker-4', { ranProfile: 'sol-reviewer' })];
  assert.equal(results.filter((result) => result.status === 'acquired').length, 3);
  assert.equal(results.filter((result) => result.reason === 'session-cap').length, 1);
  const first = results.find((result) => result.status === 'acquired');
  const firstNumber = Number(first.branch.split('/')[0]);
  const same = await acquireWorkerSlot(branches[firstNumber - 1], `worker-${firstNumber}`, { ranProfile: 'sol-reviewer' });
  assert.equal(same.idempotent, true);
  await assert.rejects(() => acquireWorkerSlot(branches[firstNumber - 1], `worker-${firstNumber}`, { ranProfile: 'fable' }), /different ranProfile/);
  const stolen = await acquireWorkerSlot(branches[firstNumber - 1], 'different-worker', { ranProfile: 'sol-reviewer' });
  assert.equal(stolen.reason, 'attempt-owned');
  await releaseWorkerSlot(opened.session, first.token);
  const queuedIndex = 3;
  const conflictRequestFile = path.join(branches[queuedIndex], 'request', 'request.json');
  const conflictRequest = JSON.parse(readFileSync(conflictRequestFile, 'utf8'));
  conflictRequest.expected.criteria[0].expected = 'tampered after open';
  writeFileSync(conflictRequestFile, JSON.stringify(conflictRequest));
  await assert.rejects(() => acquireWorkerSlot(branches[queuedIndex], `worker-${queuedIndex + 1}`, { ranProfile: 'sol-reviewer' }), /(?:frozen request hash|requestHashes)/);
  conflictRequest.expected.criteria[0].expected = 'ready';
  writeFileSync(conflictRequestFile, JSON.stringify(conflictRequest));
  const active = JSON.parse(readFileSync(stateFile, 'utf8')).workerSlots.find((slot) => slot.branch === '2/1');
  const conflict = await acquireWorkerSlot(branches[4], 'worker-5', { ranProfile: 'sol-reviewer' });
  assert.equal(conflict.reason, 'resource-conflict');
  const nestedRequest = JSON.parse(readFileSync(path.join(branches[4], 'request', 'request.json'), 'utf8'));
  assert.ok(resourcesOverlap(active.exclusive[0], nestedRequest.environment.exclusive[0]));
  await Promise.all(Array.from({ length: 20 }, () => mutateSession(opened.session, async (fresh) => { fresh.budget.units = (fresh.budget.units ?? 0) + 1; })));
  assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).budget.units, 20);
}));

test('a source-writing attempt automatically leases the real workspace behind a junction alias', async () => fixture(async ({ sessions, worktree }) => {
  const opened = await openSession(sessions, draft(worktree));
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user-message:1' });
  const realCheckout = path.join(worktree, 'real-checkout');
  const aliasCheckout = path.join(worktree, 'checkout-alias');
  mkdirSync(realCheckout, { recursive: true });
  symlinkSync(realCheckout, aliasCheckout, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(normalizeResource(realCheckout), normalizeResource(aliasCheckout));
  const stateFile = path.join(opened.session, 'state.json');
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  state.chain = [['1/1'], ['2/1']];
  state.steps = { '1/1': 'environment.preflight', '2/1': 'environment.preflight' };
  writeFileSync(stateFile, JSON.stringify(state));
  for (const [index, checkout] of [realCheckout, aliasCheckout].entries()) {
    const n = index + 1;
    const branch = path.join(opened.session, `step-${n}`, 'parallel-1');
    mkdirSync(path.join(branch, 'request'), { recursive: true });
    const request = {
      contractVersion: V22_CONTRACT, schemaVersion: 9, operatorId: 'environment.preflight', step: n, parallel: 1, sessionId: opened.sessionId,
      contexts: [], requirements: { project: 'sample' }, inputs: {}, resume: null, goal: { doneWhen: 0 },
      attempt: { id: `junction-a${n}`, number: 1, kind: 'initial', previous: null },
      expected: { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [{ id: 'ready', required: true, expected: 'ready', verification: 'receipt' }] },
      environment: { isolationId: `junction-a${n}`, mode: 'inline', workspace: { alias: '@workspaces/fe', worktree: checkout, revision: null }, reads: [], writes: ['@workspaces/fe'], exclusive: [], outputRoot: 'response' },
      frozenInputs: []
    };
    if (n === 1) {
      const uncovered = { ...request, environment: { ...request.environment, workspace: null } };
      writeFileSync(path.join(branch, 'request', 'request.json'), JSON.stringify(uncovered));
      assert.ok((await validateRequest(root, branch)).errors.some((error) => error.includes('no concrete environment.exclusive owner')));
    }
    writeFileSync(path.join(branch, 'request', 'request.json'), JSON.stringify(request));
    await openAttempt(branch);
  }
  const first = await acquireWorkerSlot(path.join(opened.session, 'step-1', 'parallel-1'), 'writer-1', { ranProfile: 'sol-reviewer' });
  assert.equal(first.status, 'acquired');
  const second = await acquireWorkerSlot(path.join(opened.session, 'step-2', 'parallel-1'), 'writer-2', { ranProfile: 'sol-reviewer' });
  assert.equal(second.reason, 'resource-conflict');
  assert.equal(second.conflictsWith, '1/1');
}));

test('a same-session input cannot dispatch until its exact producer is matched and sealed', async () => fixture(async ({ sessions, worktree }) => {
  const opened = await openSession(sessions, draft(worktree));
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user-message:1' });
  const stateFile = path.join(opened.session, 'state.json');
  const producer = path.join(opened.session, 'step-1', 'parallel-1');
  mkdirSync(path.join(producer, 'request'), { recursive: true });
  mkdirSync(path.join(producer, 'response', 'data'), { recursive: true });
  const producerRequest = { contractVersion: V22_CONTRACT, schemaVersion: 9, operatorId: 'business.decide', step: 1, parallel: 1, sessionId: opened.sessionId, contexts: [], requirements: {}, inputs: {}, resume: null, attempt: { id: 'producer-a1', number: 1, kind: 'initial', previous: null } };
  const producerResponse = {
    contractVersion: V22_CONTRACT, schemaVersion: 9, operatorId: 'business.decide', step: 1, parallel: 1, status: 'done',
    fields: { model: 'response/data/model.json' }, fallbacks: [], commits: [], next: [],
    attempt: { id: 'producer-a1', number: 1, expectedVersion: 1 },
    actual: { expectedVersion: 1, observedAt: new Date().toISOString(), observations: [] },
    comparison: { expectedVersion: 1, verdict: 'matched', criteria: [], next: 'advance' }
  };
  writeFileSync(path.join(producer, 'request', 'request.json'), JSON.stringify(producerRequest));
  writeFileSync(path.join(producer, 'response', 'data', 'model.json'), '{"model":"accepted"}\n');
  writeFileSync(path.join(producer, 'response', 'response.json'), JSON.stringify(producerResponse));
  const producerRequestBytes = readFileSync(path.join(producer, 'request', 'request.json'));
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  state.mission.doneWhen = [{ evidence: 'an architecture decision is accepted', producedBy: 'architecture.decide' }];
  state.chain = [['1/1'], ['2/1'], ['3/1']];
  state.steps = { '1/1': 'business.decide', '2/1': 'architecture.decide', '3/1': 'architecture.decide' };
  state.requestHashes['1/1'] = sha(producerRequestBytes);
  state.attempts['1/1'] = {
    id: 'producer-a1', operatorId: 'business.decide', number: 1, kind: 'initial', previous: null,
    expectedVersion: 1, expectedHash: sha(Buffer.from('{}')), expected: {}, frozenInputs: [], status: 'running',
    requestRef: 'step-1/parallel-1/request/request.json', startedAt: new Date().toISOString()
  };
  writeFileSync(stateFile, JSON.stringify(state));

  const consumerRequest = (step, id) => ({
    contractVersion: V22_CONTRACT, schemaVersion: 9, operatorId: 'architecture.decide', step, parallel: 1, sessionId: opened.sessionId,
    contexts: [{ alias: '@workspaces/be', head: null }, { alias: '@worktrees/businesses/sample', head: null }],
    requirements: { objective: 'choose one architecture', constraints: [{ id: 'goal', kind: 'fixed-intent', statement: 'retain accepted behavior' }] },
    inputs: { model: 'step-1/parallel-1/response/data/model.json' }, resume: null, goal: { doneWhen: 0 },
    attempt: { id, number: 1, kind: 'initial', previous: null },
    expected: { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [{ id: 'decision', required: true, expected: 'one architecture is selected', verification: 'validate the decision receipt' }] },
    environment: { isolationId: id, mode: 'isolated', workspace: null, reads: ['@workspaces/be', '@worktrees/businesses/sample'], writes: [], exclusive: [], outputRoot: 'response' }, frozenInputs: []
  });
  const firstConsumer = path.join(opened.session, 'step-2', 'parallel-1');
  mkdirSync(path.join(firstConsumer, 'request'), { recursive: true });
  writeFileSync(path.join(firstConsumer, 'request', 'request.json'), JSON.stringify(consumerRequest(2, 'consumer-a1')));
  await assert.rejects(() => openAttempt(firstConsumer), /dependent worker waits for matched acceptance/);

  const acceptedManifest = await buildEvidenceManifest(producer);
  await mutateSession(opened.session, async (fresh) => {
    Object.assign(fresh.attempts['1/1'], { status: 'matched', responseRef: 'step-1/parallel-1/response/response.json', endedAt: new Date().toISOString(), comparison: producerResponse.comparison, evidenceManifest: acceptedManifest });
  });
  assert.equal((await openAttempt(firstConsumer)).state, 'opened');
  const acquired = await acquireWorkerSlot(firstConsumer, 'consumer-worker', { ranProfile: 'sol-reviewer' });
  assert.equal(acquired.status, 'acquired');
  const skeleton = JSON.parse(readFileSync(path.join(firstConsumer, 'response', 'response.json'), 'utf8'));
  assert.equal(skeleton.boundProfile, 'sol-reviewer');
  assert.equal(skeleton.ranProfile, 'sol-reviewer');
  await releaseWorkerSlot(opened.session, acquired.token);

  writeFileSync(path.join(producer, 'response', 'data', 'model.json'), '{"model":"tampered-after-accept"}\n');
  const secondConsumer = path.join(opened.session, 'step-3', 'parallel-1');
  mkdirSync(path.join(secondConsumer, 'request'), { recursive: true });
  writeFileSync(path.join(secondConsumer, 'request', 'request.json'), JSON.stringify(consumerRequest(3, 'consumer-a2')));
  await assert.rejects(() => openAttempt(secondConsumer), /evidence inventory changed after acceptance/);
}));

test('mission-owned helpers acquire and release the same three slots with concrete support owners', async () => fixture(async ({ sessions, worktree }) => {
  const opened = await openSession(sessions, draft(worktree));
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user-message:1' });
  const makeRequest = (suffix, product = `product-${suffix}`) => {
    const runId = `20260905-12000${suffix}-run`;
    const runDir = path.join(worktree, '.worktrees', 'helpers', 'generate-banks', 'runs', runId);
    const bankDir = path.join(worktree, '.worktrees', 'banked', product);
    mkdirSync(runDir, { recursive: true });
    const requestFile = path.join(runDir, 'request.json');
    const request = {
      contractVersion: V22_CONTRACT, schemaVersion: 1, helperId: 'generate-banks', runId,
      hostBinding: { kind: 'codex-task', hostId: 'codex-task-42', worktree, starciSessionId: opened.sessionId },
      profile: { boundProfile: 'sol-reviewer', ranProfile: 'sol-reviewer' },
      environment: {
        isolationId: `helper-${suffix}`, mode: 'isolated', reads: ['@worktrees/unchecked'],
        writes: [{ alias: '@worktrees/helpers/generate-banks', path: runDir }, { alias: `@worktrees/banked/${product}`, path: bankDir }],
        exclusive: [runDir, bankDir], outputRoot: runDir
      }
    };
    writeFileSync(requestFile, JSON.stringify(request));
    return { requestFile, request, runDir, bankDir };
  };
  const requests = [1, 2, 3, 4].map((n) => makeRequest(n));
  const first = await Promise.all(requests.slice(0, 3).map((item, index) => acquireHelperSlot(opened.session, item.requestFile, `helper-worker-${index + 1}`)));
  assert.equal(first.filter((result) => result.status === 'acquired').length, 3);
  const capped = await acquireHelperSlot(opened.session, requests[3].requestFile, 'helper-worker-4');
  assert.equal(capped.reason, 'session-cap');
  const same = await acquireHelperSlot(opened.session, requests[0].requestFile, 'helper-worker-1');
  assert.equal(same.idempotent, true);
  const stolen = await acquireHelperSlot(opened.session, requests[0].requestFile, 'other-worker');
  assert.equal(stolen.reason, 'attempt-owned');
  await releaseWorkerSlot(opened.session, first[0].token);
  const overlapping = makeRequest(5, 'product-2/child');
  const conflict = await acquireHelperSlot(opened.session, overlapping.requestFile, 'helper-worker-5');
  assert.equal(conflict.reason, 'resource-conflict');
  assert.equal(conflict.conflictsWith, 'helper/generate-banks/20260905-120002-run');
  const escaped = makeRequest(6);
  escaped.request.environment.writes[1].path = path.join(worktree, 'src');
  writeFileSync(escaped.requestFile, JSON.stringify(escaped.request));
  await assert.rejects(() => acquireHelperSlot(opened.session, escaped.requestFile, 'helper-worker-6'), /escapes the host worktree's \.worktrees support root/);
  const underLeased = makeRequest(7);
  underLeased.request.environment.exclusive[1] = path.join(underLeased.bankDir, 'child-only');
  writeFileSync(underLeased.requestFile, JSON.stringify(underLeased.request));
  await assert.rejects(() => acquireHelperSlot(opened.session, underLeased.requestFile, 'helper-worker-7'), /has no covering exclusive resource owner/);
  const current = JSON.parse(readFileSync(path.join(opened.session, 'state.json'), 'utf8'));
  assert.equal(current.workerSlots.length, 2);
  assert.ok(current.workerSlots.every((lease) => lease.workerKind === 'helper'));
  const stateSchema = JSON.parse(readFileSync(path.join(root, 'templates', 'step', 'state.schema.json'), 'utf8'));
  assert.deepEqual(validateAgainst(stateSchema, current, 'state.json'), []);
}));

test('knowledge mutation acceptance validates the frozen manifest while predispatch validates live sources', async () => fixture(async ({ base }) => {
  const scripts = path.join(base, 'scripts');
  const branch = path.join(base, 'session', 'step-1', 'parallel-1');
  mkdirSync(path.join(branch, 'request'), { recursive: true });
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, 'knowledge-manifest.mjs'), [
    "export const knowledgeManifestErrors = () => ['live-manifest-check'];",
    "export const frozenKnowledgeManifestErrors = () => ['frozen-manifest-check'];"
  ].join('\n'));
  writeFileSync(path.join(scripts, 'ui-knowledge-gate.mjs'), [
    "export const routedFamily = () => 'core';",
    'export const frozenFamilyUnderstandingErrors = () => [];'
  ].join('\n'));
  const request = { contractVersion: V22_CONTRACT, operatorId: 'interface.plan', contexts: [{ alias: '@knowledge/grammars/core' }] };
  assert.deepEqual(await uiKnowledgeRequestErrors(base, branch, request), ['live-manifest-check']);
  assert.deepEqual(await withRequestPhase('accept', () => uiKnowledgeRequestErrors(base, branch, request)), ['frozen-manifest-check']);
}));
