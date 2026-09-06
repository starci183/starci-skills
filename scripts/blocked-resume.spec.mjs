import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSession, confirmSession, discoveryFor, cleanupFixtureOwners } from './v23-test-fixture.mjs';
import { retainInvocation, readContext } from './mission-history.mjs';
import { buildEvidenceManifest, evidenceManifestErrors } from './evidence-manifest.mjs';
import { previewRevision, commitRevision, planHistoryErrors } from './plan-history.mjs';
import { openAttempt, acceptAttempt } from './attempt-gate.mjs';
import { acquireWorkerSlot } from './worker-slots.mjs';
import { expectedCheckIds, authorizationClasses } from '../operators/environment-preflight/validate.mjs';
import { loadEnvironmentSchema } from './validate-request.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const write = (file, value) => writeFile(file, json(value));

async function fixture(t, { active = false } = {}) {
  const owner = await mkdtemp(path.join(os.tmpdir(), 'starci-blocked-resume-'));
  t.after(async () => { cleanupFixtureOwners(owner); await rm(owner, { recursive: true, force: true }); });
  const hostId = `native-${path.basename(owner)}`;
  const opened = await openSession(path.join(owner, '.worktrees/sessions'), { project: 'resume', hostBinding: { kind: 'codex-task', hostId, worktree: owner, sourcePromptRef: 'user:opening' }, mission: { language: 'en', goal: 'Publish a pending business head.', target: 'Example business', includes: ['Business documentation'], excludes: ['Product source changes and runtime operations'], outputs: ['Pending business model'], doneWhen: [{ evidence: 'The pending business head has complete model and coverage evidence.', producedBy: 'business.decide' }], verification: 'Validate the pending head.', sourceRef: 'user:opening' } });
  const session = opened.session, stateFile = path.join(session, 'state.json');
  const read = async () => JSON.parse(await readFile(stateFile, 'utf8'));
  let state = await read();
  state.mission.discovery = discoveryFor(state.project, { tags: ['business', 'documentation'], stage: 'handoff', head: state.mission.discovery.repositories[0].head });
  await write(stateFile, state);
  await confirmSession(session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:scope' });
  state = await read();
  state.chain = [['1/1'], ['2/1'], ['3/1']];
  state.steps = { '1/1': 'environment.preflight', '2/1': 'workspace.bind', '3/1': 'business.decide' };
  state.planned = { '1/1': { requirements: { roles: ['be'], runtimeRoles: [] } }, '2/1': { requirements: { role: 'be' } }, '3/1': { requirements: {} } };
  state.current = '1/1';
  const expected = { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/prerequisite:2/1', criteria: [{ id: 'readiness', required: true, expected: 'No readiness walls remain.', verification: 'Read every applicable readiness check.' }] };
  const request = { contractVersion: 'starci/v2.2', schemaVersion: 9, sessionId: state.id, operatorId: 'environment.preflight', step: 1, parallel: 1, contexts: [], requirements: { project: state.project, roles: ['be'], runtimeRoles: [], env: 'dev', flow: null, resume: null }, inputs: {}, resume: null, goal: { prerequisite: '2/1' }, attempt: { id: 'preflight-a1', number: 1, kind: 'initial', previous: null }, expected, frozenInputs: [], environment: { isolationId: 'preflight-a1', mode: 'inline', workspace: null, reads: [], writes: [], exclusive: [], outputRoot: 'response' } };
  const ids = ['checkout.be.policy', 'checkout.be.clean', ...['identity-provisioning', 'seed', 'runtime', 'stack-up', 'service', 'external-upload', 'release'].map(id => `approval.${id}`)];
  const report = { project: state.project, roles: ['be'], env: 'dev', flow: null, declarationRef: null, generatedAt: '2026-09-06T09:48:31.000Z', checks: ids.map(id => ({ id, family: id.split('.')[0], status: 'wall', evidence: 'The old contract required this declaration.', owner: 'declaration' })), walls: ids.map(checkId => ({ checkId, owner: 'declaration', repair: 'Supply the declaration required by the old readiness contract.' })) };
  const comparison = { expectedVersion: 1, verdict: 'mismatched', criteria: [{ criterionId: 'readiness', verdict: 'mismatched', evidence: ['response/data/readiness-report.json'], note: 'Nine readiness walls were observed.' }], next: 'blocked' };
  const response = { contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: request.operatorId, step: 1, parallel: 1, status: 'blocked', stop: 'ENVIRONMENT_NOT_READY', reason: 'The historical readiness contract required nine unrelated declarations.', fields: { 'environment-readiness': 'response/response.md', 'readiness-report': 'response/data/readiness-report.json' }, commits: [], next: [], fallbacks: [], attempt: { id: request.attempt.id, number: 1, expectedVersion: 1 }, actual: { expectedVersion: 1, observedAt: report.generatedAt, observations: [{ criterionId: 'readiness', observed: 'Nine walls remain.', evidence: ['response/data/readiness-report.json'] }] }, comparison, profiles: { bound: 'retired-reviewer', ran: 'retired-reviewer' } };
  const branch = path.join(session, 'step-1/parallel-1');
  await mkdir(path.join(branch, 'request'), { recursive: true });
  await mkdir(path.join(branch, 'response/data'), { recursive: true });
  await write(path.join(branch, 'request/request.json'), request);
  await write(path.join(branch, 'response/response.json'), response);
  await write(path.join(branch, 'response/data/readiness-report.json'), report);
  await writeFile(path.join(branch, 'response/response.md'), '# Historical readiness\n\nNine declared walls blocked this invocation.\n');
  state.requestHashes['1/1'] = hash(json(request));
  state.attempts['1/1'] = { ...request.attempt, operatorId: request.operatorId, expectedVersion: 1, expectedHash: hash(JSON.stringify(expected)), expected, frozenInputs: [], status: 'blocked', context: await retainInvocation(session, state, request, { root }), requestRef: 'step-1/parallel-1/request/request.json', responseRef: 'step-1/parallel-1/response/response.json', startedAt: '2026-09-06T09:46:12.000Z', endedAt: '2026-09-06T09:48:38.000Z', comparison, evidenceManifest: await buildEvidenceManifest(branch) };
  state.lifecycle.phase = active ? 'active' : 'blocked'; state.status = active ? 'running' : 'blocked';
  if (!active) state.stoppedAt = { branch: '1/1', operator: request.operatorId, stop: response.stop, why: response.reason };
  await write(stateFile, state);
  const flags = { edit: { kind: 'resume', cell: '1/1' }, continuation: { hostId, sourceRef: 'user:resume', delta: 'Runtime readiness contract repaired' } };
  return { owner, session, branch, stateFile, read, state, request, flags };
}

for (const active of [false, true]) test(`legacy ${active ? 'externally active' : 'blocked'} session resumes with an immutable audit and a new preflight coordinate`, async t => {
  const f = await fixture(t, { active }), before = await readFile(f.stateFile, 'utf8');
  const attempt = structuredClone(f.state.attempts['1/1']), invocation = await readFile(path.join(f.session, attempt.context.ref));
  const preview = await previewRevision(root, f.session, f.flags);
  assert.equal(await readFile(f.stateFile, 'utf8'), before, 'preview is read-only');
  const cell = Object.keys(preview.forecast.resumes).find(cell => preview.forecast.resumes[cell] === '1/1');
  assert.ok(cell && cell !== '1/1');
  assert.equal(preview.forecast.steps[cell], 'environment.preflight');
  assert.equal(preview.forecast.chain[0][0], '1/1');
  assert.match(preview.preview, /new invocation must prove current readiness/);
  const result = await commitRevision(root, f.session, { previewHash: preview.previewHash, flags: f.flags, reason: 'Resume from the sealed stop using the repaired readiness contract.' });
  assert.equal(result.historicalReuse, 'none');
  const state = await f.read(), record = readContext(f.session, state.planHistory.active, 'plans');
  assert.equal(state.lifecycle.phase, 'active'); assert.equal(state.status, 'running'); assert.equal(state.stoppedAt, undefined);
  assert.equal(record.continuation.fromLifecycle.phase, active ? 'active' : 'blocked');
  assert.equal(record.continuation.fromStatus, active ? 'running' : 'blocked');
  assert.deepEqual(record.continuation.stoppedAt, f.state.stoppedAt ?? null);
  assert.deepEqual(state.attempts['1/1'], attempt);
  assert.deepEqual(await readFile(path.join(f.session, attempt.context.ref)), invocation);
  assert.deepEqual(await evidenceManifestErrors(f.branch, attempt.evidenceManifest), []);
  assert.deepEqual(planHistoryErrors(f.session, state), []);
  assert.equal(state.current, cell); assert.deepEqual(state.resumes[cell], { resumes: '1/1', stop: 'ENVIRONMENT_NOT_READY' });
  assert.equal(state.attempts[cell], undefined, 'continuation does not manufacture a successful retry');
});

for (const [label, mutate, pattern] of [
  ['missing owner continuation request', f => { delete f.flags.continuation; }, /CONTINUATION_REQUIRED|active, confirmed/],
  ['wrong native owner', f => { f.flags.continuation.hostId = 'another-task'; }, /CONTINUATION_OWNER/],
  ['no provenance source', f => { delete f.flags.continuation.sourceRef; }, /sourceRef/],
  ['changed frozen scope', async f => { f.state.mission.goal = 'Different outcome'; await write(f.stateFile, f.state); }, /SCOPE|scope|confirmation/],
  ['changed retained operator chain', async f => { f.state.steps['3/1'] = 'architecture.decide'; await write(f.stateFile, f.state); }, /PLAN_LEGACY_MAPPING_REQUIRED/],
  ['tampered historical stop', async f => { const file = path.join(f.branch, 'response/response.json'), response = JSON.parse(await readFile(file)); response.stop = 'INVALID_INPUT'; await write(file, response); }, /evidenceManifest/],
  ['live worker lease', async f => { f.state.workerSlots = [{ token: 'busy' }]; await write(f.stateFile, f.state); }, /CONTINUATION_BUSY/]
]) test(`continuation preview rejects ${label}`, async t => {
  const f = await fixture(t); await mutate(f);
  const before = await readFile(f.stateFile, 'utf8');
  await assert.rejects(previewRevision(root, f.session, f.flags), pattern);
  assert.equal(await readFile(f.stateFile, 'utf8'), before);
});

test('reviewed continuation digest binds the owner request and actual prior lifecycle', async t => {
  const f = await fixture(t), preview = await previewRevision(root, f.session, f.flags);
  const changed = structuredClone(f.flags); changed.continuation.delta = 'A different claimed repair';
  await assert.rejects(commitRevision(root, f.session, { previewHash: preview.previewHash, flags: changed, reason: 'Attempt stale review.' }), /PLAN_PREVIEW_STALE/);
  f.state.lifecycle.phase = 'active'; f.state.status = 'running'; delete f.state.stoppedAt; await write(f.stateFile, f.state);
  await assert.rejects(commitRevision(root, f.session, { previewHash: preview.previewHash, flags: f.flags, reason: 'Prior lifecycle changed after review.' }), /PLAN_PREVIEW_STALE/);
  assert.equal((await f.read()).planHistory, undefined);
});

test('a resumed preflight opens and acquires its current profile but must still prove current readiness at acceptance', async t => {
  const f = await fixture(t), preview = await previewRevision(root, f.session, f.flags);
  await commitRevision(root, f.session, { previewHash: preview.previewHash, flags: f.flags, reason: 'Run the current preflight at its new coordinate.' });
  let state = await f.read(); const cell = state.current, [step, parallel] = cell.split('/').map(Number);
  const branch = path.join(f.session, `step-${step}`, `parallel-${parallel}`);
  await mkdir(path.join(branch, 'request'), { recursive: true });
  const aliases = [`@workspaces/projects/${state.project}/be`, `@workspaces/local/routes/${state.project}/be`, '@workspaces/device-state', `@workspaces/ports/${state.project}`, '@worktrees/sessions/central-runtime'];
  const request = structuredClone(f.request);
  Object.assign(request, { step, parallel, contexts: aliases.map(alias => ({ alias, head: null })), goal: preview.forecast.goals[cell], resume: { step: 1, parallel: 1, token: 'readiness-contract-repaired' }, attempt: { id: 'preflight-a2', number: 2, kind: 'resume', previous: 'preflight-a1' } });
  request.requirements = { ...request.requirements, ...state.planned[cell].requirements, env: 'resume-fixture-env', resume: 'readiness-contract-repaired' };
  request.expected = { ...request.expected, version: 2, sourceRef: `state.json#mission:v1/prerequisite:${request.goal.prerequisite}` };
  request.environment = { ...request.environment, isolationId: 'preflight-a2', reads: aliases, outputRoot: path.join(branch, 'response') };
  await write(path.join(branch, 'request/request.json'), request);
  assert.equal((await openAttempt(branch)).state, 'opened');
  assert.equal((await acquireWorkerSlot(branch, 'synthetic-worker', { ranProfile: 'sol-reviewer' })).status, 'acquired');
  const responseFile = path.join(branch, 'response/response.json'), skeleton = JSON.parse(await readFile(responseFile, 'utf8'));
  const schema = JSON.parse(await readFile(path.join(root, 'templates/kinds/readiness-report.schema.json'), 'utf8'));
  const ids = expectedCheckIds(schema, ['be'], authorizationClasses(await loadEnvironmentSchema(root)));
  const wall = { checkId: 'declaration.be', owner: 'declaration', repair: 'Declare and hydrate a valid portable route before retrying.' };
  const report = { project: state.project, roles: ['be'], env: request.requirements.env, flow: null, declarationRef: null, generatedAt: new Date().toISOString(), checks: ids.map(id => ({ id, family: id.split('.')[0], status: id === wall.checkId ? 'wall' : 'skipped', owner: id === wall.checkId ? 'declaration' : null, evidence: id === wall.checkId ? 'The synthetic portable role declaration is absent.' : 'The frozen documentation scope or missing route leaves this check inapplicable.' })), walls: [wall] };
  const receipt = `# environment-readiness — ${state.project}\n\nCurrent scoped readiness retains the real declaration wall.\n\n## Binding\n\n| Field | Value |\n| --- | --- |\n| Project | ${state.project} |\n| Roles | be |\n| Environment | ${report.env} |\n| Flow | — |\n| Declaration | — |\n\n## Checks\n\n| Check | Family | Status | Evidence |\n| --- | --- | --- | --- |\n${report.checks.map(check => `| \`${check.id}\` | ${check.family} | ${check.status} | ${check.evidence} |`).join('\n')}\n\n## Walls\n\n| Wall | Owner | Repair |\n| --- | --- | --- |\n| \`${wall.checkId}\` | ${wall.owner} | ${wall.repair} |\n\n## Fallbacks taken\n\n| Code | Action |\n| --- | --- |\n`;
  await mkdir(path.join(branch, 'response/data'), { recursive: true });
  await write(path.join(branch, 'response/data/readiness-report.json'), report);
  await writeFile(path.join(branch, 'response/response.md'), receipt);
  const response = { ...skeleton, status: 'blocked', stop: 'ENVIRONMENT_NOT_READY', reason: 'The real declaration.be wall remains after unrelated checks are skipped.', fields: { 'environment-readiness': 'response/response.md', 'readiness-report': 'response/data/readiness-report.json' }, actual: { expectedVersion: 2, observedAt: report.generatedAt, observations: [{ criterionId: 'readiness', observed: 'One declaration wall remains.', evidence: ['response/data/readiness-report.json'] }] }, comparison: { expectedVersion: 2, verdict: 'mismatched', criteria: [{ criterionId: 'readiness', verdict: 'mismatched', evidence: ['response/data/readiness-report.json'], note: 'The route must be declared before readiness can match.' }], next: 'blocked' } };
  await write(responseFile, response);
  const falseSuccess = { ...response, status: 'done', stop: null, next: ['workspace.bind'], comparison: { ...response.comparison, verdict: 'matched', next: 'advance', criteria: response.comparison.criteria.map(row => ({ ...row, verdict: 'matched' })) } };
  await write(responseFile, falseSuccess);
  await assert.rejects(acceptAttempt(branch), /wall|done|blocked/i);
  assert.equal((await f.read()).attempts[cell].status, 'running', 'failed acceptance cannot mark the retry successful');
  await write(responseFile, response);
  assert.equal((await acceptAttempt(branch)).state, 'blocked');
  state = await f.read(); assert.deepEqual(state.workerSlots, []);
  assert.equal(state.attempts[cell].status, 'blocked');
  assert.deepEqual(await evidenceManifestErrors(f.branch, f.state.attempts['1/1'].evidenceManifest), []);
});
