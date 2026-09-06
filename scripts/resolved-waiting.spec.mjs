import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildEvidenceManifest } from './evidence-manifest.mjs';
import { resolvedWaitingAttemptKeys, resolvedWaitingReplanErrors } from './resolved-waiting.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const expectedHash = (value) => sha(Buffer.from(JSON.stringify(value)));
const put = (session, ref, value) => {
  const file = path.join(session, ref);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
};

async function fixture({ childStatus = 'mismatched', successorStatus = 'matched', recordSuccessor = true } = {}) {
  const session = mkdtempSync(path.join(tmpdir(), 'resolved-waiting-'));
  const sessionId = path.basename(session);
  const parentKey = '2/1';
  const childKey = '2/1/critique';
  const successorKey = '3/1';
  const parentExpected = { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/prerequisite:3/1', criteria: [] };
  const childExpected = { version: 1, goalVersion: 1, sourceRef: 'step-2/parallel-1/response/data/stack-model.json', criteria: [] };
  const successorExpected = { version: 2, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [] };
  const parentRequest = { contractVersion: 'starci/v2.2', sessionId, operatorId: 'architecture.decide', step: 2, parallel: 1, attempt: { id: 'parent-a1', number: 1, kind: 'initial', previous: null }, expected: parentExpected, frozenInputs: [] };
  const parentResponse = { contractVersion: 'starci/v2.2', operatorId: 'architecture.decide', step: 2, parallel: 1, status: 'waiting', fields: { 'stack-model': 'response/data/stack-model.json' }, awaiting: { exchange: 'critique', kind: 'independent-critique' }, attempt: { id: 'parent-a1', number: 1, expectedVersion: 1 } };
  const childRequest = { contractVersion: 'starci/v2.2', sessionId, operatorId: 'architecture.decide', step: 2, parallel: 1, exchange: 'critique', attempt: { id: 'child-a1', number: 1, kind: 'initial', previous: null }, expected: childExpected, inputs: { 'stack-model': 'step-2/parallel-1/response/data/stack-model.json' }, frozenInputs: [] };
  const childComparison = { expectedVersion: 1, verdict: childStatus, criteria: [], next: 'repair' };
  const childResponse = { contractVersion: 'starci/v2.2', operatorId: 'architecture.decide', step: 2, parallel: 1, exchange: 'critique', status: 'mismatch', fields: { 'independent-critique': 'response/critique.md' }, attempt: { id: 'child-a1', number: 1, expectedVersion: 1 }, comparison: childComparison };
  const successorRequest = { contractVersion: 'starci/v2.2', sessionId, operatorId: 'architecture.decide', step: 3, parallel: 1, attempt: { id: 'successor-a2', number: 2, kind: 'repair', previous: 'parent-a1' }, expected: successorExpected, resume: { step: 2, parallel: 1, token: 'repair-review' }, frozenInputs: [] };
  const successorComparison = { expectedVersion: 2, verdict: 'matched', criteria: [], next: 'advance' };
  const successorResponse = { contractVersion: 'starci/v2.2', operatorId: 'architecture.decide', step: 3, parallel: 1, status: successorStatus === 'waiting' ? 'waiting' : 'done', ...(successorStatus === 'waiting' ? { awaiting: { exchange: 'critique', kind: 'independent-critique' } } : { comparison: successorComparison }), fields: {}, attempt: { id: 'successor-a2', number: 2, expectedVersion: 2 } };
  put(session, 'step-2/parallel-1/request/request.json', parentRequest);
  put(session, 'step-2/parallel-1/response/response.json', parentResponse);
  put(session, 'step-2/parallel-1/response/data/stack-model.json', '{"selected":"candidate"}\n');
  put(session, 'step-2/parallel-1/critique/request/request.json', childRequest);
  put(session, 'step-2/parallel-1/critique/response/response.json', childResponse);
  put(session, 'step-2/parallel-1/critique/response/critique.md', '# faithful review\n');
  put(session, 'step-3/parallel-1/request/request.json', successorRequest);
  if (recordSuccessor) put(session, 'step-3/parallel-1/response/response.json', successorResponse);
  const parentDir = path.join(session, 'step-2', 'parallel-1');
  const childDir = path.join(parentDir, 'critique');
  const successorDir = path.join(session, 'step-3', 'parallel-1');
  const state = {
    id: sessionId, contractVersion: 'starci/v2.2', chain: [['1/1'], [parentKey], [successorKey]],
    mission: { version: 1 },
    steps: { '1/1': 'workspace.bind', [parentKey]: 'architecture.decide', [successorKey]: 'architecture.decide' },
    resumes: { [successorKey]: { resumes: parentKey, stop: 'CRITIQUE_UNRESOLVED' } },
    requestHashes: {
      [parentKey]: sha(readFileSync(path.join(parentDir, 'request', 'request.json'))),
      [childKey]: sha(readFileSync(path.join(childDir, 'request', 'request.json'))),
      [successorKey]: sha(readFileSync(path.join(successorDir, 'request', 'request.json')))
    },
    attempts: {
      [parentKey]: { id: 'parent-a1', operatorId: 'architecture.decide', number: 1, expectedVersion: 1, expectedHash: expectedHash(parentExpected), expected: parentExpected, frozenInputs: [], status: 'waiting', requestRef: 'step-2/parallel-1/request/request.json', responseRef: 'step-2/parallel-1/response/response.json', startedAt: 'now', endedAt: 'later', evidenceManifest: await buildEvidenceManifest(parentDir) },
      [childKey]: { id: 'child-a1', operatorId: 'architecture.decide', number: 1, expectedVersion: 1, expectedHash: expectedHash(childExpected), expected: childExpected, frozenInputs: [], status: childStatus, requestRef: 'step-2/parallel-1/critique/request/request.json', responseRef: 'step-2/parallel-1/critique/response/response.json', startedAt: 'now', endedAt: 'later', comparison: childComparison, evidenceManifest: await buildEvidenceManifest(childDir) }
    }
  };
  if (recordSuccessor) state.attempts[successorKey] = { id: 'successor-a2', operatorId: 'architecture.decide', number: 2, previous: 'parent-a1', expectedVersion: 2, expectedHash: expectedHash(successorExpected), expected: successorExpected, frozenInputs: [], status: successorStatus, requestRef: 'step-3/parallel-1/request/request.json', responseRef: 'step-3/parallel-1/response/response.json', startedAt: 'now', endedAt: 'later', ...(successorStatus === 'matched' ? { comparison: successorComparison } : {}), evidenceManifest: await buildEvidenceManifest(successorDir) };
  return { session, state, parentKey, childKey, successorKey, successorRequest, parentDir, childDir };
}

async function withFixture(options, run) {
  const value = await fixture(options);
  try { await run(value); } finally { rmSync(value.session, { recursive: true, force: true }); }
}

test('an exact sealed terminal review authorizes only its bound later same-operator replan', async () => withFixture({}, async ({ session, state, parentKey, successorRequest }) => {
  assert.deepEqual(await resolvedWaitingReplanErrors(root, session, state, successorRequest, { requireSuccessorRecorded: true, requireSuccessorTerminal: true }), []);
  const resolved = await resolvedWaitingAttemptKeys(root, session, state, { requireSuccessorTerminal: true });
  assert.deepEqual(resolved.errors, []);
  assert.deepEqual([...resolved.settled], [parentKey]);
}));

test('an accepted inconclusive review may route the same sealed resolved-by-replan transition', async () => withFixture({ childStatus: 'inconclusive' }, async ({ session, state, successorRequest }) => {
  assert.deepEqual(await resolvedWaitingReplanErrors(root, session, state, successorRequest, { requireSuccessorRecorded: true, requireSuccessorTerminal: true }), []);
}));

test('a running or waiting successor is bound for active validation but does not settle the parent for closure', async () => withFixture({ successorStatus: 'waiting' }, async ({ session, state, parentKey, successorRequest }) => {
  assert.deepEqual(await resolvedWaitingReplanErrors(root, session, state, successorRequest, { requireSuccessorRecorded: true }), []);
  const active = await resolvedWaitingAttemptKeys(root, session, state);
  assert.deepEqual(active.errors, []);
  assert.deepEqual([...active.settled], []);
  assert.match((await resolvedWaitingAttemptKeys(root, session, state, { requireSuccessorTerminal: true })).errors.join('\n'), /no terminal accepted successor/);
}));

test('a sealed waiting successor may itself be resolved by one later terminal replan', async () => withFixture({ successorStatus: 'waiting' }, async ({ session, state, parentKey, successorKey }) => {
  const sessionId = state.id;
  const middleDir = path.join(session, 'step-3', 'parallel-1');
  const middleResponse = { contractVersion: 'starci/v2.2', operatorId: 'architecture.decide', step: 3, parallel: 1, status: 'waiting', fields: { 'stack-model': 'response/data/stack-model.json' }, awaiting: { exchange: 'critique', kind: 'independent-critique' }, attempt: { id: 'successor-a2', number: 2, expectedVersion: 2 } };
  put(session, 'step-3/parallel-1/response/response.json', middleResponse);
  put(session, 'step-3/parallel-1/response/data/stack-model.json', '{"selected":"repair"}\n');
  state.attempts[successorKey].evidenceManifest = await buildEvidenceManifest(middleDir);

  const childKey = '3/1/critique';
  const childExpected = { version: 1, goalVersion: 1, sourceRef: 'step-3/parallel-1/response/data/stack-model.json', criteria: [] };
  const childRequest = { contractVersion: 'starci/v2.2', sessionId, operatorId: 'architecture.decide', step: 3, parallel: 1, exchange: 'critique', attempt: { id: 'middle-child-a1', number: 1, kind: 'initial', previous: null }, expected: childExpected, inputs: { 'stack-model': childExpected.sourceRef }, frozenInputs: [] };
  const childComparison = { expectedVersion: 1, verdict: 'inconclusive', criteria: [], next: 'retry' };
  const childResponse = { contractVersion: 'starci/v2.2', operatorId: 'architecture.decide', step: 3, parallel: 1, exchange: 'critique', status: 'mismatch', fields: { 'independent-critique': 'response/critique.md' }, attempt: { id: 'middle-child-a1', number: 1, expectedVersion: 1 }, comparison: childComparison };
  put(session, 'step-3/parallel-1/critique/request/request.json', childRequest);
  put(session, 'step-3/parallel-1/critique/response/response.json', childResponse);
  put(session, 'step-3/parallel-1/critique/response/critique.md', '# retry review\n');
  const childDir = path.join(middleDir, 'critique');
  state.requestHashes[childKey] = sha(readFileSync(path.join(childDir, 'request', 'request.json')));
  state.attempts[childKey] = { id: 'middle-child-a1', operatorId: 'architecture.decide', number: 1, expectedVersion: 1, expectedHash: expectedHash(childExpected), expected: childExpected, frozenInputs: [], status: 'inconclusive', requestRef: 'step-3/parallel-1/critique/request/request.json', responseRef: 'step-3/parallel-1/critique/response/response.json', startedAt: 'now', endedAt: 'later', comparison: childComparison, evidenceManifest: await buildEvidenceManifest(childDir) };

  const terminalKey = '4/1';
  const terminalExpected = { version: 3, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [] };
  const terminalRequest = { contractVersion: 'starci/v2.2', sessionId, operatorId: 'architecture.decide', step: 4, parallel: 1, attempt: { id: 'terminal-a3', number: 3, kind: 'retry', previous: 'successor-a2' }, expected: terminalExpected, resume: { step: 3, parallel: 1, token: 'retry-review' }, frozenInputs: [] };
  const terminalComparison = { expectedVersion: 3, verdict: 'matched', criteria: [], next: 'advance' };
  const terminalResponse = { contractVersion: 'starci/v2.2', operatorId: 'architecture.decide', step: 4, parallel: 1, status: 'done', fields: {}, attempt: { id: 'terminal-a3', number: 3, expectedVersion: 3 }, comparison: terminalComparison };
  put(session, 'step-4/parallel-1/request/request.json', terminalRequest);
  put(session, 'step-4/parallel-1/response/response.json', terminalResponse);
  const terminalDir = path.join(session, 'step-4', 'parallel-1');
  state.chain.push([terminalKey]);
  state.steps[terminalKey] = 'architecture.decide';
  state.resumes[terminalKey] = { resumes: successorKey, stop: 'CRITIQUE_UNRESOLVED' };
  state.requestHashes[terminalKey] = sha(readFileSync(path.join(terminalDir, 'request', 'request.json')));
  state.attempts[terminalKey] = { id: 'terminal-a3', operatorId: 'architecture.decide', number: 3, previous: 'successor-a2', expectedVersion: 3, expectedHash: expectedHash(terminalExpected), expected: terminalExpected, frozenInputs: [], status: 'matched', requestRef: 'step-4/parallel-1/request/request.json', responseRef: 'step-4/parallel-1/response/response.json', startedAt: 'now', endedAt: 'later', comparison: terminalComparison, evidenceManifest: await buildEvidenceManifest(terminalDir) };

  const resolved = await resolvedWaitingAttemptKeys(root, session, state, { requireSuccessorTerminal: true });
  assert.deepEqual(resolved.errors, []);
  assert.equal(resolved.settled.has(parentKey), true);
  assert.equal(resolved.settled.has(successorKey), true);
}));

test('resolved waiting authority rejects tampering, unrelated links and state narration', async () => {
  const cases = [
    ['unsealed parent', ({ state, parentKey }) => { delete state.attempts[parentKey].evidenceManifest; }],
    ['tampered parent', ({ parentDir }) => writeFileSync(path.join(parentDir, 'response', 'data', 'stack-model.json'), 'changed')],
    ['unsealed child', ({ state, childKey }) => { delete state.attempts[childKey].evidenceManifest; }],
    ['non-review child status', ({ state, childKey }) => { state.attempts[childKey].status = 'blocked'; }],
    ['tampered child', ({ childDir }) => writeFileSync(path.join(childDir, 'response', 'critique.md'), 'changed')],
    ['resealed cross-session parent', async ({ session, state, parentKey, parentDir }) => { const file = path.join(parentDir, 'request', 'request.json'); const request = JSON.parse(readFileSync(file)); request.sessionId = 'another-session'; writeFileSync(file, JSON.stringify(request)); state.requestHashes[parentKey] = sha(readFileSync(file)); state.attempts[parentKey].evidenceManifest = await buildEvidenceManifest(parentDir); }],
    ['resealed cross-session child', async ({ state, childKey, childDir }) => { const file = path.join(childDir, 'request', 'request.json'); const request = JSON.parse(readFileSync(file)); request.sessionId = 'another-session'; writeFileSync(file, JSON.stringify(request)); state.requestHashes[childKey] = sha(readFileSync(file)); state.attempts[childKey].evidenceManifest = await buildEvidenceManifest(childDir); }],
    ['resealed child consuming an older model', async ({ state, childKey, childDir }) => { const file = path.join(childDir, 'request', 'request.json'); const request = JSON.parse(readFileSync(file)); request.inputs['stack-model'] = 'step-1/parallel-1/response/data/stack-model.json'; request.expected.sourceRef = request.inputs['stack-model']; writeFileSync(file, JSON.stringify(request)); state.requestHashes[childKey] = sha(readFileSync(file)); state.attempts[childKey].expected = request.expected; state.attempts[childKey].expectedHash = expectedHash(request.expected); state.attempts[childKey].evidenceManifest = await buildEvidenceManifest(childDir); }],
    ['resealed cross-session successor', async ({ session, state, successorKey, successorRequest }) => { successorRequest.sessionId = 'another-session'; const dir = path.join(session, 'step-3', 'parallel-1'); const file = path.join(dir, 'request', 'request.json'); writeFileSync(file, JSON.stringify(successorRequest)); state.requestHashes[successorKey] = sha(readFileSync(file)); state.attempts[successorKey].evidenceManifest = await buildEvidenceManifest(dir); }],
    ['wrong exchange', ({ session }) => { const file = path.join(session, 'step-2/parallel-1/response/response.json'); const value = JSON.parse(readFileSync(file)); value.awaiting.exchange = 'review'; writeFileSync(file, JSON.stringify(value)); }],
    ['wrong stop', ({ state, successorKey }) => { state.resumes[successorKey].stop = 'INVALID_INPUT'; }],
    ['wrong operator', ({ successorRequest }) => { successorRequest.operatorId = 'business.decide'; }],
    ['wrong previous', ({ successorRequest }) => { successorRequest.attempt.previous = 'other'; }],
    ['wrong resume', ({ successorRequest }) => { successorRequest.resume.step = 1; }],
    ['future link', ({ state, successorKey }) => { state.chain = [['1/1'], [successorKey], ['2/1']]; }],
    ['cycle', ({ successorRequest }) => { successorRequest.resume.step = 3; }],
    ['fabricated state link', ({ state, successorKey }) => { delete state.attempts[successorKey]; }],
    ['narration only', ({ state, successorKey }) => { delete state.resumes[successorKey]; state.transitions = [{ branch: successorKey, event: 'resolved', note: 'claimed in prose' }]; }]
  ];
  for (const [name, mutate] of cases) await withFixture({}, async (value) => {
    await mutate(value);
    const errors = await resolvedWaitingReplanErrors(root, value.session, value.state, value.successorRequest, { requireSuccessorRecorded: true, requireSuccessorTerminal: true });
    assert.ok(errors.length, `${name} unexpectedly granted replan authority`);
  });
});
