import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { acceptedBlockedResponse } from './accepted-blocked.mjs';
import { buildEvidenceManifest } from './evidence-manifest.mjs';
import { retainContext, readContext } from './mission-history.mjs';
import { scopeHash } from './mission-scope.mjs';

const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const json = value => `${JSON.stringify(value, null, 2)}\n`;
async function fixture(t) {
  const session = await mkdtemp(path.join(os.tmpdir(), 'starci-blocked-history-'));
  t.after(() => rm(session, { recursive: true, force: true }));
  const branch = path.join(session, 'step-1/parallel-1');
  await mkdir(path.join(branch, 'request'), { recursive: true });
  await mkdir(path.join(branch, 'response/data'), { recursive: true });
  const mission = { version: 1, language: 'en', goal: 'Publish a pending business model.', target: 'Example', includes: ['Documents'], excludes: ['Product writes'], outputs: ['Pending model'], doneWhen: [{ producedBy: 'business.decide', evidence: 'Pending business head exists.' }], verification: 'Validate the head.', sourceRef: 'user:scope' };
  mission.confirmation = { status: 'confirmed', decisionId: 'goal:sample:v1', sourceRef: 'user:scope', scopeHash: scopeHash(mission) };
  const choice = { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:scope' };
  const expected = { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/prerequisite:2/1', criteria: [{ id: 'readiness', required: true, expected: 'No walls', verification: 'Readiness report' }] };
  const request = { contractVersion: 'starci/v2.2', schemaVersion: 9, sessionId: 'sample', operatorId: 'environment.preflight', step: 1, parallel: 1, attempt: { id: 'preflight-a1', number: 1, kind: 'initial', previous: null }, expected, frozenInputs: [], requirements: { project: 'sample', runtimeRoles: [] }, goal: { prerequisite: '2/1' } };
  const comparison = { expectedVersion: 1, verdict: 'mismatched', criteria: [{ criterionId: 'readiness', verdict: 'mismatched', evidence: ['response/data/readiness-report.json'] }], next: 'blocked' };
  const response = { contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: request.operatorId, step: 1, parallel: 1, status: 'blocked', stop: 'ENVIRONMENT_NOT_READY', attempt: { id: request.attempt.id, number: 1, expectedVersion: 1 }, actual: { expectedVersion: 1, observedAt: '2026-09-06T09:48:31.000Z', observations: [{ criterionId: 'readiness', observed: 'An approval is absent.', evidence: ['response/data/readiness-report.json'] }] }, comparison, profiles: { ran: 'retired-reviewer' } };
  await writeFile(path.join(branch, 'request/request.json'), json(request));
  await writeFile(path.join(branch, 'response/response.json'), json(response));
  await writeFile(path.join(branch, 'response/data/readiness-report.json'), json({ checks: [{ id: 'approval.seed', status: 'wall' }], walls: [{ checkId: 'approval.seed' }] }));
  const state = { contractVersion: 'starci/v2.2', id: 'sample', mission, choices: { [mission.confirmation.decisionId]: choice }, lifecycle: { phase: 'blocked' }, chain: [['1/1'], ['2/1']], steps: { '1/1': request.operatorId, '2/1': 'business.decide' }, requestHashes: { '1/1': hash(json(request)) } };
  const missionAddress = await retainContext(session, 'missions', { version: 1, sessionId: state.id, mission, choice });
  state.missionSnapshots = { 1: missionAddress };
  const context = await retainContext(session, 'invocations', { version: 1, sessionId: state.id, key: '1/1', attemptId: request.attempt.id, requestHash: state.requestHashes['1/1'], mission: missionAddress, choices: state.choices, chain: state.chain, steps: state.steps, planned: {}, planRevision: null });
  const attempt = { ...request.attempt, operatorId: request.operatorId, expectedVersion: 1, expectedHash: hash(JSON.stringify(expected)), expected, frozenInputs: [], status: 'blocked', context, requestRef: 'step-1/parallel-1/request/request.json', responseRef: 'step-1/parallel-1/response/response.json', startedAt: '2026-09-06T09:46:12.000Z', endedAt: '2026-09-06T09:48:38.000Z', comparison, evidenceManifest: await buildEvidenceManifest(branch) };
  state.attempts = { '1/1': attempt };
  return { session, branch, state, attempt, request, response, read: () => acceptedBlockedResponse('unused-current-runtime', session, state, '1/1') };
}

test('sealed historical blocked reason survives changed operator law and retired profiles without becoming matched proof', async t => {
  const f = await fixture(t), before = JSON.stringify(f.state);
  assert.deepEqual(await f.read(), f.response);
  assert.equal(JSON.stringify(f.state), before);
  f.state.lifecycle.phase = 'active';
  assert.equal((await f.read()).status, 'blocked');
  assert.equal(await readFile(path.join(f.branch, 'response/response.json'), 'utf8'), json(f.response));
});

for (const [name, mutate] of [
  ['unaccepted running attempt', f => { f.attempt.status = 'running'; }],
  ['matched attempt cannot use blocked continuity', f => { f.attempt.status = 'matched'; }],
  ['missing evidence seal', f => { delete f.attempt.evidenceManifest; }],
  ['missing invocation seal', f => { delete f.attempt.context; }],
  ['missing acceptance timestamp', f => { delete f.attempt.endedAt; }],
  ['changed goal in same version', f => { f.state.mission.goal = 'Different goal'; }],
  ['changed mission version', f => { f.state.mission.version = 2; }],
  ['removed user confirmation', f => { delete f.state.choices[f.state.mission.confirmation.decisionId]; }],
  ['changed expected ledger', f => { f.attempt.expectedHash = `sha256:${'0'.repeat(64)}`; }],
  ['changed comparison ledger', f => { f.attempt.comparison = { ...f.attempt.comparison, verdict: 'inconclusive' }; }],
  ['changed invocation identity ledger', f => { f.attempt.id = 'invented'; }],
  ['changed frozen request hash', f => { f.state.requestHashes['1/1'] = `sha256:${'0'.repeat(64)}`; }],
  ['redirected response coordinate', f => { f.attempt.responseRef = '../response.json'; }],
  ['changed stop bytes', async f => { await writeFile(path.join(f.branch, 'response/response.json'), json({ ...f.response, stop: 'INVENTED_STOP' })); }],
  ['changed readiness evidence', async f => { await writeFile(path.join(f.branch, 'response/data/readiness-report.json'), '{}'); }],
  ['changed frozen request bytes', async f => { await writeFile(path.join(f.branch, 'request/request.json'), json({ ...f.request, requirements: {} })); }],
  ['changed immutable invocation bytes', async f => { await writeFile(path.join(f.session, f.attempt.context.ref), '{}'); }],
  ['changed immutable mission bytes', async f => { await writeFile(path.join(f.session, f.state.missionSnapshots[1].ref), '{}'); }],
  ['resealed invocation with wrong operator', async f => { const context = readContext(f.session, f.attempt.context, 'invocations'); context.steps['1/1'] = 'business.decide'; f.attempt.context = await retainContext(f.session, 'invocations', context); }],
  ['resealed non-blocked response', async f => { await writeFile(path.join(f.branch, 'response/response.json'), json({ ...f.response, status: 'done', stop: null })); f.attempt.evidenceManifest = await buildEvidenceManifest(f.branch); }],
  ['resealed response from different attempt', async f => { await writeFile(path.join(f.branch, 'response/response.json'), json({ ...f.response, attempt: { ...f.response.attempt, id: 'other' } })); f.attempt.evidenceManifest = await buildEvidenceManifest(f.branch); }]
]) test(`historical blocked continuity rejects ${name}`, async t => {
  const f = await fixture(t); await mutate(f);
  await assert.rejects(f.read, /HISTORY|evidenceManifest|ENOENT/);
});

test('continuity refuses non-top-level or escaping coordinates', async t => {
  const f = await fixture(t);
  for (const cell of ['../1', '1/1/review', '0/1']) await assert.rejects(acceptedBlockedResponse('', f.session, f.state, cell), /coordinate/);
});
