import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { openSession, confirmSession, cleanupFixtureOwners } from './v23-test-fixture.mjs';
import { retainInvocation, invocationState, missionAt, retainMission, retainContext, missionHistorySnapshotErrors } from './mission-history.mjs';
import { openAttempt, acceptAttempt } from './attempt-gate.mjs';
import { validateStep } from './validate-step.mjs';
import { restatementDecisionId, recordRestatementChoice } from './restatement-choice.mjs';
import { editForecast } from './plan-history.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
async function fixture(t) {
  const owner = await mkdtemp(path.join(os.tmpdir(), 'starci-history-'));
  t.after(async () => { cleanupFixtureOwners(owner); await rm(owner, { recursive: true, force: true }); });
  const opened = await openSession(path.join(owner, '.worktrees/sessions'), { project: 'history', hostBinding: { kind: 'codex-task', hostId: `native-${path.basename(owner)}`, worktree: owner, sourcePromptRef: 'user:opening' }, mission: { language: 'en', goal: 'Retain the requested artifact.', target: 'Session artifact', includes: ['Bounded documentation'], excludes: [], outputs: ['Evidence'], doneWhen: [{ evidence: 'Evidence is reviewable.', producedBy: 'content.generate' }], verification: 'Read the artifact.', sourceRef: 'user:opening' } });
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved' });
  const state = JSON.parse(await readFile(path.join(opened.session, 'state.json')));
  const request = { step: 1, parallel: 1, attempt: { id: '1/1:a1' }, expected: { goalVersion: 1 }, operatorId: 'content.generate' };
  const branch = path.join(opened.session, 'step-1/parallel-1');
  await mkdir(path.join(branch, 'request'), { recursive: true });
  const bytes = JSON.stringify(request); await writeFile(path.join(branch, 'request/request.json'), bytes);
  state.chain = [['1/1']]; state.steps = { '1/1': 'content.generate' }; state.requestHashes = { '1/1': sha(bytes) };
  state.attempts['1/1'] = { id: request.attempt.id, context: await retainInvocation(opened.session, state, request, { root }), requestRef: 'step-1/parallel-1/request/request.json' };
  return { session: opened.session, state, request, branch };
}

test('confirmation retains exact mission and invocation retains its original choices across later answers and mission changes', async t => {
  const f = await fixture(t); const original = missionAt(f.session, f.state, 1);
  assert.equal(original.mission.version, 1);
  const originalBytes = await readFile(path.join(f.session, f.state.missionSnapshots[1].ref));
  f.state.choices['restatement:example:v1:answer'] = { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:later-answer' };
  f.state.mission = { ...f.state.mission, version: 2, goal: 'A materially corrected mission' };
  const historical = invocationState(f.session, f.state, f.request);
  assert.equal(historical.mission.version, 1);
  assert.equal(historical.mission.goal, original.mission.goal);
  assert.equal(historical.choices['restatement:example:v1:answer'], undefined);
  assert.deepEqual(await readFile(path.join(f.session, f.state.missionSnapshots[1].ref)), originalBytes);
  assert.deepEqual(missionHistorySnapshotErrors(f.session, f.state), []);
});

test('missing, forged, retargeted or modified invocation context cannot validate another goal version', async t => {
  const f = await fixture(t); const context = f.state.attempts['1/1'].context;
  f.state.mission.version = 2;
  delete f.state.attempts['1/1'].context;
  assert.throws(() => invocationState(f.session, f.state, f.request), /MISSION_HISTORY_MISSING/);
  f.state.attempts['1/1'].context = { ...context, ref: '../state.json' };
  assert.throws(() => invocationState(f.session, f.state, f.request), /HISTORY_UNBOUND/);
  f.state.attempts['1/1'].context = context;
  await writeFile(path.join(f.branch, 'request/request.json'), JSON.stringify({ ...f.request, step: 2 }));
  assert.throws(() => invocationState(f.session, f.state, f.request), /INVOCATION_HISTORY_UNBOUND/);
  await writeFile(path.join(f.branch, 'request/request.json'), JSON.stringify(f.request));
  await writeFile(path.join(f.session, context.ref), '{}');
  assert.throws(() => invocationState(f.session, f.state, f.request), /HISTORY_TAMPERED/);
});

test('an existing mission address cannot be overwritten with a changed scope or invented user answer', async t => {
  const f = await fixture(t);
  const before = await readFile(path.join(f.session, f.state.missionSnapshots[1].ref));
  f.state.choices[f.state.mission.confirmation.decisionId].sourceRef = 'agent:invented';
  await assert.rejects(retainMission(f.session, f.state, { root }), /MISSION_HISTORY_UNBOUND/);
  assert.deepEqual(await readFile(path.join(f.session, f.state.missionSnapshots[1].ref)), before);
});

test('context retention refuses a foreign history junction before creating anything beneath its target',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'starci-history-junction-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const session=path.join(directory,'session'), foreign=path.join(directory,'foreign');
  await mkdir(path.join(session,'runtime'),{recursive:true});await mkdir(foreign);
  await symlink(foreign,path.join(session,'runtime/history'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(retainContext(session,'missions',{goal:'must stay inside'}),/escaped the owning session/);
  assert.deepEqual(await readdir(foreign),[]);
});

test('official open and accept preserve a blocked v1 reading after its answer and a corrected v2 reading, without borrowing either choice', async t => {
  const owner = await mkdtemp(path.join(os.tmpdir(), 'starci-history-accept-'));
  t.after(async () => { cleanupFixtureOwners(owner); await rm(owner, { recursive: true, force: true }); });
  const opened = await openSession(path.join(owner, '.worktrees/sessions'), { project: 'reading', hostBinding: { kind: 'codex-task', hostId: `native-${path.basename(owner)}`, worktree: owner, sourcePromptRef: 'user:opening' }, mission: { language: 'en', goal: 'Decide the bounded promise.', target: 'Declared promise', includes: ['Promise authority'], excludes: [], outputs: ['Business decision'], doneWhen: [{ evidence: 'The promise is decided.', producedBy: 'business.decide' }], verification: 'Validate the decision.', sourceRef: 'user:opening' } });
  const session = opened.session, stateFile = path.join(session, 'state.json');
  await confirmSession(session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved-v1' });
  async function blockedReading(step, version, promise) {
    const branch = path.join(session, `step-${step}/parallel-1`);
    await mkdir(path.join(branch, 'request'), { recursive: true });
    const contexts = [{ alias: '@workspaces/be', head: null }, { alias: '@worktrees/businesses/feature', head: null }];
    const request = { contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: 'business.decide', sessionId: opened.sessionId, step, parallel: 1, contexts, requirements: { featureId: 'feature', targetState: 'pending', promise, dimensions: ['actor-eligibility'] }, inputs: {}, resume: null, goal: { doneWhen: 0 }, attempt: { id: `${step}/1:a1`, number: 1, kind: 'initial', previous: null }, expected: { version: 1, goalVersion: version, sourceRef: `state.json#mission:v${version}/doneWhen:0`, criteria: [{ id: 'decision', required: true, expected: 'The promise is decided.', verification: 'Read the decision receipt.' }] }, environment: { isolationId: `${step}/1:a1`, mode: 'isolated', workspace: null, reads: contexts.map(item => item.alias), writes: [], exclusive: [], outputRoot: 'response' }, frozenInputs: [] };
    const state = JSON.parse(await readFile(stateFile)); state.steps[`${step}/1`] = 'business.decide'; state.chain.push([`${step}/1`]); state.current = `${step}/1`; await writeFile(stateFile, JSON.stringify(state));
    await writeFile(path.join(branch, 'request/request.json'), JSON.stringify(request));
    assert.equal((await openAttempt(branch)).state, 'opened');
    const text = `# restatement — feature\n\n## Restatement\n\n| Line | Statement |\n| --- | --- |\n| 1 | ${promise} |\n\n## Source\n\n| Field | Value |\n| --- | --- |\n| Field | \`promise\` |\n| Quoted | ${promise} |\n`;
    await writeFile(path.join(branch, 'response/restatement.md'), text);
    const decisionId = restatementDecisionId(request, 'feature', text);
    const response = { contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: 'business.decide', step, parallel: 1, status: 'blocked', stop: 'RESTATEMENT_UNCONFIRMED', fields: { restatement: 'response/restatement.md' }, fallbacks: [], commits: [], next: [], boundProfile: 'sol-reviewer', ranProfile: 'sol-reviewer', attempt: { id: request.attempt.id, number: 1, expectedVersion: 1 }, actual: { expectedVersion: 1, observedAt: new Date().toISOString(), observations: [{ criterionId: 'decision', observed: 'The reading awaits the user answer.', evidence: ['response/restatement.md'] }] }, comparison: { expectedVersion: 1, verdict: 'inconclusive', criteria: [{ criterionId: 'decision', verdict: 'inconclusive', evidence: ['response/restatement.md'], note: 'No decision is published before the reading is confirmed.' }], next: 'blocked' }, interaction: { kind: 'restatement-confirm', decisionId, options: [{ id: 'as-stated', label: 'As stated', tradeoff: 'Use this reading' }, { id: 'corrected', label: 'Corrected', tradeoff: 'Use the supplied correction' }] } };
    await writeFile(path.join(branch, 'response/response.json'), JSON.stringify(response));
    if (step === 2) {
      const admitted = JSON.parse(await readFile(stateFile)); delete admitted.attempts['2/1'].context;
      await writeFile(stateFile, JSON.stringify(admitted));
    }
    assert.equal((await acceptAttempt(branch)).state, 'blocked');
    if (step === 2) {
      const admitted = JSON.parse(await readFile(stateFile));
      const context = JSON.parse(await readFile(path.join(session,admitted.attempts['2/1'].context.ref)));
      assert.equal(context.phase,'acceptance','an already running current request records the actual capture boundary, not invented opening history');
    }
    return { branch, request, decisionId };
  }
  const first = await blockedReading(1, 1, 'One installation belongs to the workspace.');
  const originalPlan = { chain: [['1/1'],['2/1']], steps: {'1/1':'business.decide','2/1':'architecture.decide'}, goals: {'1/1':{doneWhen:0},'2/1':{doneWhen:0}}, reasons:{}, presets:{}, dependencies:{'1/1':[],'2/1':['1/1']}, evidenceDependencies:{'1/1':[],'2/1':['1/1']}, handoffs:{}, nodes:{'1/1':'business.decide','2/1':'architecture.decide'}, imports:{}, fanout:{} };
  await assert.rejects(editForecast(root, session, JSON.parse(await readFile(stateFile)), originalPlan, {kind:'resume',cell:'1/1'},2), /actual user answer/);
  const answerFile = path.join(first.branch, 'actual-answer.json');
  await writeFile(answerFile, JSON.stringify({ selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:first-reading' }));
  const answered = await promisify(execFile)(process.execPath, [path.join(root, 'scripts/restatement-choice.mjs'), 'answer', first.branch, answerFile], { timeout: 15000 });
  assert.equal(JSON.parse(answered.stdout).selected, 'as-stated');
  assert.doesNotMatch(answered.stderr, /unsettled top-level await/);
  const amended = await editForecast(root, session, JSON.parse(await readFile(stateFile)), originalPlan, {kind:'resume',cell:'1/1'},2);
  assert.deepEqual(amended.chain, [['1/1'],['2/1'],['3/1']]);
  assert.equal(amended.resumes['2/1'], '1/1'); assert.deepEqual(amended.dependencies['3/1'], ['2/1']);
  assert.deepEqual(JSON.parse(await readFile(path.join(first.branch,'request/request.json'))), first.request);
  // The sealed owner can have an unopened independent successor belonging to a parallel
  // peer's path. Its position must survive re-entry before the shared consumer.
  const independentPlan = structuredClone(originalPlan);
  independentPlan.chain = [['1/1'], ['2/1'], ['3/1']];
  independentPlan.steps['2/1'] = 'data.plan'; independentPlan.steps['3/1'] = 'architecture.decide';
  independentPlan.goals['2/1'] = { prerequisite: '3/1' }; independentPlan.goals['3/1'] = { doneWhen: 0 };
  independentPlan.dependencies['2/1'] = []; independentPlan.dependencies['3/1'] = ['1/1', '2/1'];
  independentPlan.evidenceDependencies = structuredClone(independentPlan.dependencies);
  independentPlan.nodes['2/1'] = 'independent-plan'; independentPlan.nodes['3/1'] = 'consumer';
  const independentResume = await editForecast(root, session, JSON.parse(await readFile(stateFile)), independentPlan, { kind: 'resume', cell: '1/1' }, 3);
  assert.equal(independentResume.steps['2/1'], 'data.plan');
  assert.equal(independentResume.steps['3/1'], 'business.decide');
  assert.equal(independentResume.resumes['3/1'], '1/1');
  assert.deepEqual(independentResume.dependencies['4/1'], ['3/1', '2/1']);
  assert.deepEqual(independentResume.evidenceDependencies['4/1'], ['3/1', '2/1']);
  assert.equal(independentResume.nodes['2/1'], 'independent-plan');
  assert.deepEqual(independentPlan.dependencies['3/1'], ['1/1', '2/1']);
  const mixedPlan = structuredClone(independentPlan);
  mixedPlan.chain = [['1/1'], ['2/1', '3/1']];
  mixedPlan.dependencies['3/1'] = ['1/1']; mixedPlan.evidenceDependencies['3/1'] = ['1/1'];
  mixedPlan.goals['2/1'] = { doneWhen: 0 };
  const mixedResume = await editForecast(root, session, JSON.parse(await readFile(stateFile)), mixedPlan, { kind: 'resume', cell: '1/1' }, 3);
  assert.deepEqual(mixedResume.chain, [['1/1'], ['2/1'], ['3/1'], ['4/1']]);
  assert.equal(mixedResume.steps['2/1'], 'data.plan');
  assert.equal(mixedResume.steps['3/1'], 'business.decide');
  assert.equal(mixedResume.steps['4/1'], 'architecture.decide');
  assert.deepEqual(mixedResume.dependencies['4/1'], ['3/1']);
  const evidencePlan = structuredClone(mixedPlan);
  evidencePlan.dependencies['3/1'] = [];
  const evidenceResume = await editForecast(root, session, JSON.parse(await readFile(stateFile)), evidencePlan, { kind: 'resume', cell: '1/1' }, 3);
  assert.equal(evidenceResume.steps['4/1'], 'architecture.decide');
  assert.deepEqual(evidenceResume.evidenceDependencies['4/1'], ['3/1']);
  const terminalPlan = structuredClone(independentPlan);
  terminalPlan.chain = [['1/1'], ['2/1']];
  for (const field of ['steps', 'goals', 'nodes', 'dependencies', 'evidenceDependencies']) delete terminalPlan[field]['3/1'];
  terminalPlan.goals['2/1'] = { doneWhen: 0 };
  const terminalResume = await editForecast(root, session, JSON.parse(await readFile(stateFile)), terminalPlan, { kind: 'resume', cell: '1/1' }, 3);
  assert.equal(terminalResume.steps['2/1'], 'business.decide');
  assert.equal(terminalResume.steps['3/1'], 'data.plan');
  assert.equal(terminalResume.resumes['2/1'], '1/1');
  const parallelPlan = structuredClone(originalPlan);
  parallelPlan.chain = [['1/1'], ['2/1', '2/2'], ['3/1']];
  parallelPlan.steps = { '1/1': 'business.decide', '2/1': 'business.decide', '2/2': 'uat.plan', '3/1': 'architecture.decide' };
  parallelPlan.goals = { '1/1': { doneWhen: 0 }, '2/1': { doneWhen: 0 }, '2/2': { prerequisite: '3/1' }, '3/1': { doneWhen: 0 } };
  parallelPlan.dependencies = { '1/1': [], '2/1': [], '2/2': [], '3/1': ['2/1', '2/2'] };
  parallelPlan.evidenceDependencies = structuredClone(parallelPlan.dependencies);
  parallelPlan.presets['2/2'] = { access: 'authenticated', fixtures: 'seeded', sourceRoles: 'full' };
  parallelPlan.nodes = { '1/1': 'prior-reading', '2/1': 'current-business', '2/2': 'current-uat-plan', '3/1': 'current-architecture' };
  const beforeParallel = structuredClone(parallelPlan);
  const sealedBytes = await readFile(path.join(first.branch, 'response/response.json'));
  const parallelResume = await editForecast(root, session, JSON.parse(await readFile(stateFile)), parallelPlan, { kind: 'resume', cell: '2/1', source: '1/1' }, 3);
  assert.deepEqual(parallelResume.chain, [['1/1'], ['2/1', '2/2'], ['3/1']]);
  assert.equal(parallelResume.resumes['2/1'], '1/1');
  for (const field of ['steps', 'goals', 'presets', 'nodes', 'dependencies', 'evidenceDependencies']) assert.deepEqual(parallelResume[field]['2/2'], beforeParallel[field]['2/2'], `unopened peer ${field} is preserved`);
  assert.deepEqual(parallelResume.dependencies['3/1'], ['2/1', '2/2']);
  assert.equal(parallelResume.nodes['1/1'], 'prior-reading');
  assert.deepEqual(parallelPlan, beforeParallel);
  assert.deepEqual(await readFile(path.join(first.branch, 'response/response.json')), sealedBytes);
  assert.deepEqual(JSON.parse(await readFile(path.join(first.branch, 'request/request.json'))), first.request);
  let state = JSON.parse(await readFile(stateFile));
  await confirmSession(session, { selected: 'corrected', selectedBy: 'user', sourceRef: 'user:scope-correction', mission: { ...state.mission, goal: 'Decide support for many independently owned installations.' } });
  await confirmSession(session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved-v2' });
  const second = await blockedReading(2, 2, 'Many installations belong to the workspace.');
  assert.notEqual(second.decisionId, first.decisionId);
  assert.deepEqual((await validateStep(root, first.branch, { operator: true, requestPhase: 'accept' })).errors, []);
  assert.deepEqual((await validateStep(root, second.branch, { operator: true, requestPhase: 'accept' })).errors, []);
  state = JSON.parse(await readFile(stateFile));
  assert.equal(state.choices[first.decisionId].sourceRef, 'user:first-reading');
  assert.equal(state.choices[second.decisionId], undefined);
  await assert.rejects(recordRestatementChoice(first.branch, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:reuse-old-reading' }), /RESTATEMENT_SCOPE_MISMATCH/);
  await recordRestatementChoice(second.branch, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:actual-corrected-reading' });
  const resume = structuredClone(second.request);
  resume.step = 3; resume.resume = { step: 2, parallel: 1, token: second.decisionId }; resume.decisionId = second.decisionId; resume.selectedOption = 'as-stated';
  resume.attempt = { id: '3/1:a2', number: 2, kind: 'retry', previous: '2/1:a1' };
  resume.environment.isolationId = '3/1:a2';
  state = JSON.parse(await readFile(stateFile)); state.steps['3/1'] = 'business.decide'; state.chain.push(['3/1']); state.resumes = { '3/1': { resumes: '2/1', stop: 'RESTATEMENT_UNCONFIRMED' } }; state.current = '3/1';
  await writeFile(stateFile, JSON.stringify(state));
  const third = path.join(session, 'step-3/parallel-1'); await mkdir(path.join(third, 'request'), { recursive: true });
  await writeFile(path.join(third, 'request/request.json'), JSON.stringify({ ...resume, decisionId: first.decisionId }));
  await assert.rejects(openAttempt(third), /decision|choice|restatement/i);
  await writeFile(path.join(third, 'request/request.json'), JSON.stringify(resume));
  assert.equal((await openAttempt(third)).state, 'opened');
  assert.deepEqual((await validateStep(root, first.branch, { operator: true, requestPhase: 'accept' })).errors, []);
  assert.deepEqual((await validateStep(root, second.branch, { operator: true, requestPhase: 'accept' })).errors, []);
});
