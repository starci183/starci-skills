import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { openSession, confirmSession } from './session-open.mjs';
import { openAttempt } from './attempt-gate.mjs';
import { attemptContractErrors } from './validate-response.mjs';
import { validateRequest, V22_CONTRACT } from './validate-request.mjs';
import { v22SessionErrors } from './validate-session.mjs';
import { acquireWorkerSlot, releaseWorkerSlot, resourcesOverlap } from './worker-slots.mjs';
import { mutateSession } from './session-lock.mjs';

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
  await mutateSession(opened.session, async (fresh) => {
    fresh.attempts['1/1'].status = 'matched';
    fresh.attempts['1/1'].responseRef = 'step-1/parallel-1/response/response.json';
    fresh.attempts['1/1'].endedAt = new Date().toISOString();
    fresh.attempts['1/1'].comparison = baseResponse.comparison;
    fresh.status = 'done';
    fresh.lifecycle = { ...fresh.lifecycle, phase: 'closed-success', closedAt: new Date().toISOString(), closeReason: 'All done-when criteria matched.', compactRef: '.worktrees/done/session/bundle' };
    fresh.brief.proven = ['doneWhen:0 readiness proof retained'];
  });
  const closed = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.deepEqual(await v22SessionErrors(opened.session, closed), []);
  baseResponse.actual.observations[0].evidence = [];
  writeFileSync(path.join(branch, 'response', 'response.json'), JSON.stringify(baseResponse));
  assert.ok((await v22SessionErrors(opened.session, closed)).some((error) => error.includes('not backed by a matched v2.2 attempt')));
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
  const firstWave = await Promise.all(branches.slice(0, 3).map((branch, index) => acquireWorkerSlot(branch, `worker-${index + 1}`)));
  const results = [...firstWave, await acquireWorkerSlot(branches[3], 'worker-4')];
  assert.equal(results.filter((result) => result.status === 'acquired').length, 3);
  assert.equal(results.filter((result) => result.reason === 'session-cap').length, 1);
  const first = results.find((result) => result.status === 'acquired');
  const firstNumber = Number(first.branch.split('/')[0]);
  const same = await acquireWorkerSlot(branches[firstNumber - 1], `worker-${firstNumber}`);
  assert.equal(same.idempotent, true);
  const stolen = await acquireWorkerSlot(branches[firstNumber - 1], 'different-worker');
  assert.equal(stolen.reason, 'attempt-owned');
  await releaseWorkerSlot(opened.session, first.token);
  const queuedIndex = 3;
  const conflictRequestFile = path.join(branches[queuedIndex], 'request', 'request.json');
  const conflictRequest = JSON.parse(readFileSync(conflictRequestFile, 'utf8'));
  conflictRequest.expected.criteria[0].expected = 'tampered after open';
  writeFileSync(conflictRequestFile, JSON.stringify(conflictRequest));
  await assert.rejects(() => acquireWorkerSlot(branches[queuedIndex], `worker-${queuedIndex + 1}`), /(?:frozen request hash|requestHashes)/);
  conflictRequest.expected.criteria[0].expected = 'ready';
  writeFileSync(conflictRequestFile, JSON.stringify(conflictRequest));
  const active = JSON.parse(readFileSync(stateFile, 'utf8')).workerSlots.find((slot) => slot.branch === '2/1');
  const conflict = await acquireWorkerSlot(branches[4], 'worker-5');
  assert.equal(conflict.reason, 'resource-conflict');
  const nestedRequest = JSON.parse(readFileSync(path.join(branches[4], 'request', 'request.json'), 'utf8'));
  assert.ok(resourcesOverlap(active.exclusive[0], nestedRequest.environment.exclusive[0]));
  await Promise.all(Array.from({ length: 20 }, () => mutateSession(opened.session, async (fresh) => { fresh.budget.units = (fresh.budget.units ?? 0) + 1; })));
  assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).budget.units, 20);
}));
