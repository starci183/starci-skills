import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { openSession, confirmSession, cleanupFixtureOwners } from './v23-test-fixture.mjs';
import { openAttempt } from './attempt-gate.mjs';
import { buildEvidenceManifest } from './evidence-manifest.mjs';
import { continuationErrors } from './session-continuation.mjs';
import { validateAgainst } from './json-schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const encode = value => `${JSON.stringify(value, null, 2)}\n`;

async function fixture(t) {
  const owner = await mkdtemp(path.join(tmpdir(), 'session-continuation-'));
  t.after(async () => {
    cleanupFixtureOwners(owner);
    assert.equal(path.dirname(path.resolve(owner)), path.resolve(tmpdir()));
    assert.ok(path.basename(owner).startsWith('session-continuation-'));
    await rm(owner, { recursive: true, force: true });
  });
  const opened = await openSession(path.join(owner, '.worktrees/sessions'), { project: 'continuation', hostBinding: { kind: 'codex-task', hostId: path.basename(owner), worktree: owner, sourcePromptRef: 'user:initial-scope' }, mission: { language: 'en', goal: 'Inspect the declared readiness.', target: 'Readiness evidence', includes: ['Read-only inspection'], excludes: ['Source writes'], outputs: ['Readiness report'], doneWhen: [{ evidence: 'Readiness is observed.', producedBy: 'environment.preflight' }], verification: 'Validate the readiness report.', sourceRef: 'user:initial-scope' } });
  const session = opened.session, file = path.join(session, 'state.json'), branch = path.join(session, 'step-1/parallel-1');
  await confirmSession(session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:confirmed' });
  let state = JSON.parse(await readFile(file, 'utf8'));
  state.chain = [['1/1']]; state.steps = { '1/1': 'environment.preflight' }; state.current = '1/1';
  await writeFile(file, encode(state)); await mkdir(path.join(branch, 'request'), { recursive: true });
  const expected = { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [{ id: 'ready', required: true, expected: 'The complete readiness report is available.', verification: 'Validate the typed report.' }] };
  const request = { contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: 'environment.preflight', step: 1, parallel: 1, sessionId: state.id, contexts: [], requirements: { project: state.project }, inputs: {}, resume: null, goal: { doneWhen: 0 }, attempt: { id: 'readiness-1', number: 1, kind: 'initial', previous: null }, expected, environment: { isolationId: 'readiness-1', mode: 'inline', workspace: null, reads: [], writes: [], exclusive: [], outputRoot: 'response' }, frozenInputs: [] };
  await writeFile(path.join(branch, 'request/request.json'), encode(request));
  await openAttempt(branch);
  state = JSON.parse(await readFile(file, 'utf8'));
  const observedAt = new Date().toISOString();
  const comparison = { expectedVersion: 1, verdict: 'inconclusive', criteria: [{ criterionId: 'ready', verdict: 'inconclusive', evidence: ['response/response.md'], note: 'The reported readiness wall remains.' }], next: 'blocked' };
  const response = { contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: 'environment.preflight', step: 1, parallel: 1, status: 'blocked', stop: 'ENVIRONMENT_NOT_READY', reason: 'An observed readiness wall prevents dispatch.', fields: { 'environment-readiness': 'response/response.md' }, fallbacks: [], commits: [], next: [], boundProfile: 'sol-reviewer', ranProfile: 'sol-reviewer', attempt: { id: 'readiness-1', number: 1, expectedVersion: 1 }, actual: { expectedVersion: 1, observedAt, observations: [{ criterionId: 'ready', observed: 'The readiness wall is retained.', evidence: ['response/response.md'] }] }, comparison };
  await writeFile(path.join(branch, 'response/response.json'), encode(response)); await writeFile(path.join(branch, 'response/response.md'), '# Historical readiness\n\nThe accepted readiness wall remains historical evidence.\n');
  Object.assign(state.attempts['1/1'], { status: 'blocked', responseRef: 'step-1/parallel-1/response/response.json', endedAt: observedAt, comparison, evidenceManifest: await buildEvidenceManifest(branch) });
  state.status = 'blocked'; state.lifecycle.phase = 'blocked'; state.stoppedAt = { branch: '1/1', operator: 'environment.preflight', stop: response.stop, why: response.reason };
  await writeFile(file, encode(state));
  const flags = { edit: { kind: 'resume', cell: '1/1' }, continuation: { hostId: state.hostBinding.hostId, sourceRef: 'user:continue-current-owner', delta: 'The installed runtime now validates the retained documentation-only scope correctly.' } };
  return { owner, session, branch, file, state, flags, check: (candidate = state, options = flags) => continuationErrors(ROOT, session, candidate, options) };
}

test('continuation contract is closed and requires a nonblank owner, source and delta', async () => {
  const schema = JSON.parse(await readFile(path.join(ROOT, 'templates/step/continuation.schema.json'), 'utf8'));
  const valid = { hostId: 'native-owner', sourceRef: 'user:continue', delta: 'The exact runtime dependency is now available.' };
  assert.deepEqual(validateAgainst(schema, valid), []);
  for (const key of schema.required) {
    const missing = { ...valid }; delete missing[key]; assert.notDeepEqual(validateAgainst(schema, missing), []);
    assert.notDeepEqual(validateAgainst(schema, { ...valid, [key]: ' ' }), []);
    assert.notDeepEqual(validateAgainst(schema, { ...valid, [key]: 'a'.repeat(schema.properties[key].maxLength + 1) }), []);
  }
  assert.notDeepEqual(validateAgainst(schema, { ...valid, bypass: true }), []);
});

test('ordinary active planning is unchanged while blocked planning requires its owner request', async t => {
  const f = await fixture(t);
  assert.match((await f.check(f.state, {})).join('\n'), /CONTINUATION_REQUIRED/);
  const active = structuredClone(f.state); active.lifecycle.phase = 'active'; active.status = 'running'; delete active.stoppedAt;
  assert.deepEqual(await f.check(active, {}), []);
});

test('valid blocked and active legacy continuations are admitted without mutating state or immutable history', async t => {
  const f = await fixture(t), before = await readFile(f.file), original = structuredClone(f.state);
  const history = path.join(f.session, 'runtime/history'), entries = await readdir(history, { recursive: true });
  const files = await Promise.all(entries.filter(name => name.endsWith('.json')).map(name => readFile(path.join(history, name))));
  assert.deepEqual(await f.check(), []);
  const active = structuredClone(f.state); active.lifecycle.phase = 'active'; active.status = 'running'; delete active.stoppedAt;
  const activeBefore = structuredClone(active); assert.deepEqual(await f.check(active), []); assert.deepEqual(active, activeBefore);
  assert.deepEqual(f.state, original); assert.deepEqual(await readFile(f.file), before);
  assert.deepEqual(await readdir(history, { recursive: true }), entries);
  assert.deepEqual(await Promise.all(entries.filter(name => name.endsWith('.json')).map(name => readFile(path.join(history, name)))), files);
});

test('owner, edit, terminal coordinate and stopped receipt must match exactly', async t => {
  const f = await fixture(t);
  for (const patch of [{ continuation: { ...f.flags.continuation, hostId: 'other-owner' } }, { edit: { kind: 'expand', cell: '1/1' } }, { edit: { kind: 'resume', cell: '../1' } }, { edit: { kind: 'resume', cell: '2/1' } }]) assert.notDeepEqual(await f.check(f.state, { ...f.flags, ...patch }), []);
  for (const mutate of [state => { state.current = '2/1'; }, state => { state.stoppedAt.branch = '2/1'; }, state => { state.stoppedAt.stop = 'OTHER_STOP'; }, state => { state.stoppedAt.operator = 'business.decide'; }, state => { state.attempts['1/1'].status = 'matched'; }]) {
    const state = structuredClone(f.state); mutate(state); assert.notDeepEqual(await f.check(state), []);
  }
});

test('a continuation cannot substitute scope, confirmation, owner binding or sealed evidence', async t => {
  const f = await fixture(t);
  for (const mutate of [state => { state.mission.goal += ' and write source'; }, state => { state.mission.version += 1; }, state => { state.mission.confirmation.authority.statement += ' changed'; }, state => { state.choices[state.mission.confirmation.decisionId].sourceRef = 'user:other'; }, state => { state.workflowOwner.repository = 'https://example.invalid/other'; }, state => { state.runtimeRevision -= 1; }, state => { state.upgrade = {}; }]) {
    const state = structuredClone(f.state); mutate(state); assert.notDeepEqual(await f.check(state), []);
  }
  await writeFile(path.join(f.branch, 'response/response.md'), '# Replaced historical evidence\n');
  assert.notDeepEqual(await f.check(), []);
});

test('live obligations and nonlegacy active ledgers cannot request terminal continuation', async t => {
  const f = await fixture(t);
  for (const mutate of [state => { state.workerSlots = [{}]; }, state => { state.leases = { '1/1': {} }; }, state => { state.attempts['2/1'] = { status: 'running' }; }, state => { state.attempts['2/1'] = { status: 'waiting' }; }, state => { state.lifecycle.phase = 'failed'; }, state => { state.lifecycle.phase = 'active'; state.status = 'running'; delete state.stoppedAt; state.planHistory = { active: {} }; }]) {
    const state = structuredClone(f.state); mutate(state); assert.notDeepEqual(await f.check(state), []);
  }
  await writeFile(path.join(f.session, 'retirement.json'), '{}'); assert.notDeepEqual(await f.check(), []);
});
