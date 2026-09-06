import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { openSession, confirmSession, cleanupFixtureOwners } from './v23-test-fixture.mjs';
import { missionCorrectionBusy } from './session-open.mjs';
import { buildEvidenceManifest } from './evidence-manifest.mjs';
import { commitRevision } from './plan-history.mjs';
import { fileURLToPath } from 'node:url';

const sha = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
async function fixture(t) {
  const owner = await mkdtemp(path.join(os.tmpdir(), 'starci-correction-'));
  t.after(async () => { cleanupFixtureOwners(owner); await rm(owner, { recursive: true, force: true }); });
  const opened = await openSession(path.join(owner, '.worktrees/sessions'), { project: 'correction', hostBinding: { kind: 'codex-task', hostId: path.basename(owner), worktree: owner, sourcePromptRef: 'user:opening' }, mission: { language: 'en', goal: 'Inspect declared readiness.', target: 'Environment', includes: ['Read-only readiness'], outputs: ['Readiness report'], doneWhen: [{ evidence: 'Readiness is reported.', producedBy: 'environment.preflight' }], verification: 'Read report.', sourceRef: 'user:opening' } });
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved' });
  const file = path.join(opened.session, 'state.json');
  let state = JSON.parse(await readFile(file));
  await confirmSession(opened.session, { selected: 'corrected', selectedBy: 'user', sourceRef: 'user:second', mission: { ...state.mission, goal: 'Inspect corrected readiness.' } });
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:second-approved' });
  state = JSON.parse(await readFile(file));
  const branch = path.join(opened.session, 'step-1/parallel-1');
  await mkdir(path.join(branch, 'request'), { recursive: true });
  await mkdir(path.join(branch, 'response'), { recursive: true });
  const expected = { version: 1, goalVersion: 1 };
  const request = { contractVersion: 'starci/v2.2', sessionId: state.id, operatorId: 'architecture.decide', step: 1, parallel: 1, attempt: { id: '1/1:a1' }, expected };
  const response = { operatorId: request.operatorId, step: 1, parallel: 1, attempt: request.attempt, status: 'waiting', awaiting: { exchange: 'critique', kind: 'independent-critique' } };
  const bytes = JSON.stringify(request);
  await writeFile(path.join(branch, 'request/request.json'), bytes);
  await writeFile(path.join(branch, 'response/response.json'), JSON.stringify(response));
  state.requestHashes['1/1'] = sha(bytes);
  state.attempts['1/1'] = { id: request.attempt.id, operatorId: request.operatorId, expected, expectedHash: sha(JSON.stringify(expected)), requestRef: 'step-1/parallel-1/request/request.json', responseRef: 'step-1/parallel-1/response/response.json', status: 'waiting', startedAt: '2026-09-01T00:00:00Z', endedAt: '2026-09-01T00:01:00Z', evidenceManifest: await buildEvidenceManifest(branch) };
  await writeFile(file, JSON.stringify(state));
  return { session: opened.session, state, file, branch, correction: { selected: 'corrected', selectedBy: 'user', sourceRef: 'user:third', mission: { ...state.mission, goal: 'Inspect final readiness.' } } };
}

test('official correction preserves sealed prior-mission waiting evidence without crediting its unresolved goal', async t => {
  const f = await fixture(t), before = structuredClone(f.state.attempts);
  const bytes = await readFile(path.join(f.branch, 'response/response.json'));
  assert.equal(await missionCorrectionBusy(f.session, f.state), false);
  const result = await confirmSession(f.session, f.correction);
  assert.equal(result.version, 3);
  const state = JSON.parse(await readFile(f.file));
  assert.equal(state.mission.confirmation.status, 'draft');
  assert.deepEqual(state.attempts, before);
  assert.deepEqual(await readFile(path.join(f.branch, 'response/response.json')), bytes);
});

test('running, unsealed, current, unknown-version and leased waits still block official correction', async t => {
  const f = await fixture(t);
  const mutations = [state => { state.attempts['1/1'].status = 'running'; }, state => { delete state.attempts['1/1'].endedAt; }, state => { delete state.attempts['1/1'].evidenceManifest; }, state => { state.attempts['1/1'].expected.goalVersion = 2; }, state => { delete state.attempts['1/1'].expected.goalVersion; }, state => { state.workerSlots = [{}]; }, state => { state.leases = { held: {} }; }, state => { state.requestHashes['1/1'] = sha('different'); }, state => { state.attempts['1/1'].responseRef = '../other/response.json'; }];
  for (const mutate of mutations) {
    const state = structuredClone(f.state); mutate(state);
    await writeFile(f.file, JSON.stringify(state));
    const before = await readFile(f.file);
    await assert.rejects(confirmSession(f.session, f.correction), /MISSION_BUSY/);
    assert.deepEqual(await readFile(f.file), before);
  }
});

test('changed historical receipt bytes cannot turn an unresolved wait into a retired correction obligation', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.branch, 'response/response.json'), '{}');
  await assert.rejects(confirmSession(f.session, f.correction), /MISSION_BUSY/);
  assert.equal(JSON.parse(await readFile(f.file)).mission.version, 2);
});

test('forecast commit shares correction busy classification and still checks the historical ledger', async t => {
  const f = await fixture(t);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const input = { previewHash: `sha256:${'0'.repeat(64)}`, reason: 'Review current scope without promoting historical proof.' };
  // This minimal predicate fixture is intentionally not a complete operator receipt. It must
  // reach the ledger/preview gate rather than mistake the sealed historical wait for live work.
  await assert.rejects(commitRevision(root, f.session, input), error => !error.message.includes('PLAN_BUSY'));
  f.state.attempts['1/1'].status = 'running';
  await writeFile(f.file, JSON.stringify(f.state));
  await assert.rejects(commitRevision(root, f.session, input), /PLAN_BUSY/);
});
