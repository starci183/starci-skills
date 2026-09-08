// The mission's goal is confirmed by the person before anything runs: scripts/validate-request.mjs#missionGateErrors.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { EFFECT_TOOLS, operatorEffects, missionTouchesRuntime, missionGateErrors, goalDecisionId, validateRequest, branchGoalErrors, contextCovers, isolatedContextErrors } from './validate-request.mjs';
import { goalCheckErrors, validateResponse } from './validate-response.mjs';
import { loadOperatorPackages } from './operator-md.mjs';
import { loadInteractionPolicy } from './validate-interaction.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = await loadOperatorPackages(root);
const policy = await loadInteractionPolicy(root);
const tools = JSON.parse(await readFile(path.join(root, 'resources/tools.json'), 'utf8')).tools;
const pkg = (id) => packages.find((p) => p.manifest.id === id);
const mission = (version = 1, doneWhen = [{ evidence: 'the served head passes its audit', producedBy: 'interface.audit' }]) => ({ version, language: 'en', goal: 'the interview stands alone', includes: ['the interview page'], excludes: ['the course'], doneWhen, sourceRef: 'user-message:goal' });
const choice = (selected = 'as-stated', extra = {}) => ({ selected, selectedBy: 'user', sourceRef: 'user-message:answer', ...extra });
const live = (steps, extra = {}) => ({ id: 's', transitions: [{ at: 'now', branch: '1/1', event: 'dispatched' }], steps, ...extra });
const goal = (errors) => errors.filter((e) => e.includes("the mission's goal is not confirmed"));

test('the effect tools are tools the registry publishes, and the question kind is declared', () => {
  for (const id of EFFECT_TOOLS) assert.ok(Object.hasOwn(tools, id), `${id} is not in resources/tools.json`);
  for (const id of EFFECT_TOOLS) assert.ok(Object.hasOwn(tools[id].modes, 'never'), `${id} has no never mode`);
  assert.ok(policy.questionKinds.includes('goal-confirm'));
});
test('whether a mission writes or touches a runtime is read from operator.json tools, mode by mode', () => {
  // Read-only operators hold every effect tool in mode never or read, or not at all.
  for (const id of ['workspace.bind', 'quality.verify', 'environment.preflight', 'architecture.decide']) assert.deepEqual(operatorEffects(pkg(id)), [], id);
  assert.ok(operatorEffects(pkg('backend.generate')).some((t) => t.id === 'sourcewrite'));
  assert.ok(operatorEffects(pkg('git.publish')).some((t) => t.id === 'git' && t.mode !== 'read'));
  assert.ok(operatorEffects(pkg('interface.audit')).some((t) => t.id === 'browsercontrol'));
  assert.ok(operatorEffects(pkg('interface.generate')).some((t) => t.id === 'host'));
  assert.equal(missionTouchesRuntime(['workspace.bind', 'quality.verify'], packages), false);
  assert.equal(missionTouchesRuntime(['workspace.bind', 'uat.verify'], packages), true);
  assert.equal(missionTouchesRuntime(['no.such.operator'], packages), false);
  // The decision is made from tools, so a manifest that gains an effect tool needs the confirmation without a list changing.
  assert.equal(missionTouchesRuntime(['x.y'], [{ manifest: { id: 'x.y', resources: { tools: { '@tools/database': 'namespaced-write' } } } }]), true);
  assert.equal(missionTouchesRuntime(['x.y'], [{ manifest: { id: 'x.y', resources: { tools: { '@tools/database': 'read', '@tools/container': 'read' } } } }]), false);
});
test('the gate applies only to a live session or one that already carries a mission, like brief and budget', () => {
  assert.deepEqual(missionGateErrors({ id: 's', steps: { '1/1': 'backend.generate' } }, null, packages, policy), []);
  assert.deepEqual(missionGateErrors({ id: 's', steps: { '1/1': 'backend.generate' }, transitions: [] }, { operatorId: 'backend.generate' }, packages, policy), []);
  assert.ok(goal(missionGateErrors(live({ '1/1': 'backend.generate' }), null, packages, policy)).length);
  assert.ok(goal(missionGateErrors({ id: 's', steps: { '1/1': 'backend.generate' }, mission: mission() }, null, packages, policy)).some((e) => e.includes('choices[')));
  assert.deepEqual(missionGateErrors(null, null, packages, policy), []);
});
test('read-only work asks nothing; the request operator counts beside the recorded steps', () => {
  assert.deepEqual(missionGateErrors(live({ '1/1': 'workspace.bind' }), { operatorId: 'quality.verify', sessionId: 's' }, packages, policy), []);
  const errors = goal(missionGateErrors(live({ '1/1': 'workspace.bind' }), { operatorId: 'interface.generate', sessionId: 's' }, packages, policy));
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('no mission block'));
});
test('a confirmed mission passes; a missing, corrected, agent-selected or unreferenced choice is named', () => {
  const steps = { '1/1': 'workspace.bind', '2/1': 'uat.verify' };
  const ok = live(steps, { mission: mission(), choices: { [goalDecisionId('s', 1)]: choice() } });
  assert.deepEqual(missionGateErrors(ok, null, packages, policy), []);
  const missing = goal(missionGateErrors(live(steps, { mission: mission() }), null, packages, policy));
  assert.ok(missing.some((e) => e.includes(`choices["${goalDecisionId('s', 1)}"]`) && e.includes('goal-confirm')));
  const corrected = goal(missionGateErrors(live(steps, { mission: mission(), choices: { [goalDecisionId('s', 1)]: choice('corrected') } }), null, packages, policy));
  assert.ok(corrected.some((e) => e.includes('was corrected') && e.includes('version 2')));
  const other = goal(missionGateErrors(live(steps, { mission: mission(), choices: { [goalDecisionId('s', 1)]: choice('continue') } }), null, packages, policy));
  assert.ok(other.some((e) => e.includes('not as-stated')));
  const agent = goal(missionGateErrors(live(steps, { mission: mission(), choices: { [goalDecisionId('s', 1)]: choice('as-stated', { selectedBy: 'agent' }) } }), null, packages, policy));
  assert.ok(agent.some((e) => e.includes('never by an agent')));
  const unreferenced = goal(missionGateErrors(live(steps, { mission: mission(), choices: { [goalDecisionId('s', 1)]: choice('as-stated', { sourceRef: ' ' }) } }), null, packages, policy));
  assert.ok(unreferenced.some((e) => e.includes('sourceRef')));
});
test('the latest version is the one confirmed; an older as-stated choice confirms nothing', () => {
  const steps = { '1/1': 'interface.generate' };
  const stale = goal(missionGateErrors(live(steps, { mission: mission(2), choices: { [goalDecisionId('s', 1)]: choice() } }), null, packages, policy));
  assert.ok(stale.some((e) => e.includes(goalDecisionId('s', 2))));
  const current = live(steps, { mission: mission(2), choices: { [goalDecisionId('s', 1)]: choice('corrected'), [goalDecisionId('s', 2)]: choice() } });
  assert.deepEqual(missionGateErrors(current, null, packages, policy), []);
});
test('every done-when line names an operator that exists', () => {
  const steps = { '1/1': 'interface.generate' };
  const state = live(steps, { mission: mission(1, [{ evidence: 'a walk completes', producedBy: 'uat.verify' }, { evidence: 'somebody nods', producedBy: 'person.nods' }]), choices: { [goalDecisionId('s', 1)]: choice() } });
  const errors = goal(missionGateErrors(state, null, packages, policy));
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('person.nods') && errors[0].includes('not an operator'));
});

// The request gate refuses the request of a live session whose chain writes source on an unconfirmed goal.
async function fixture(run) {
  const session = mkdtempSync(path.join(tmpdir(), 'mission-'));
  const branch = path.join(session, 'step-2/parallel-1');
  mkdirSync(path.join(branch, 'request'), { recursive: true });
  const brief = { proven: [], blocked: [], next: 'bind', peers: {}, report: { shape: 'working', text: 'binding', at: 'now' } };
  const state = { id: 'mission', project: 'example', startedAt: '2026-09-04', status: 'running', chain: [['1/1'], ['2/1']], steps: { '1/1': 'interface.generate', '2/1': 'workspace.bind' }, current: '2/1', requestHashes: {}, transitions: [{ at: 'now', branch: '1/1', event: 'dispatched' }], brief, budget: { maxSteps: 24, maxSameOperator: 4 } };
  const request = { schemaVersion: 9, operatorId: 'workspace.bind', step: 2, parallel: 1, sessionId: 'mission', contexts: [], requirements: { project: 'example', role: 'fe' }, inputs: {}, resume: null };
  const save = () => { writeFileSync(path.join(session, 'state.json'), JSON.stringify(state)); writeFileSync(path.join(branch, 'request/request.json'), JSON.stringify(request)); };
  try { await run({ branch, state, request, save }); } finally { rmSync(session, { recursive: true, force: true }); }
}
test('the request gate refuses a live source-writing session until the goal is confirmed', async () => {
  await fixture(async ({ branch, state, save }) => {
    save();
    assert.ok(goal((await validateRequest(root, branch, packages)).errors).some((e) => e.includes('no mission block')));
    state.mission = mission(); save();
    assert.ok(goal((await validateRequest(root, branch, packages)).errors).some((e) => e.includes('choices[')));
    state.choices = { [goalDecisionId('mission', 1)]: choice() }; save();
    assert.deepEqual(goal((await validateRequest(root, branch, packages)).errors), []);
  });
});

// The branch goal: on a mission every branch points at the done-when line it serves or the branch it enables.
const onMission = (doneWhen = [{ evidence: 'the head passes the gates', producedBy: 'quality.verify' }, { evidence: 'a walk completes', producedBy: 'uat.verify' }]) => ({ id: 's', mission: mission(1, doneWhen), steps: { '1/1': 'workspace.bind', '2/1': 'quality.verify' } });
const req = (operatorId, goal, extra = {}) => ({ operatorId, step: 2, parallel: 1, sessionId: 's', goal, ...extra });
test('branchGoalErrors applies only when the session carries a mission, and refuses a branch that points at nothing', () => {
  assert.deepEqual(branchGoalErrors({ id: 's', steps: {} }, req('quality.verify')), []);
  assert.deepEqual(branchGoalErrors(null, req('quality.verify')), []);
  const none = branchGoalErrors(onMission(), req('quality.verify'));
  assert.equal(none.length, 1);
  assert.ok(none[0].includes('names its goal') && none[0].includes('goal.doneWhen') && none[0].includes('goal.prerequisite'));
});
test('goal.doneWhen is an index of the mission whose producedBy is this operator', () => {
  assert.deepEqual(branchGoalErrors(onMission(), req('quality.verify', { doneWhen: 0 })), []);
  assert.ok(branchGoalErrors(onMission(), req('quality.verify', { doneWhen: 2 })).some((e) => e.includes('doneWhen 2') && e.includes('indexes 0–1')));
  assert.ok(branchGoalErrors(onMission(), req('quality.verify', { doneWhen: 1 })).some((e) => e.includes('produced by uat.verify, not by quality.verify')));
});
test('goal.prerequisite names a recorded branch other than itself; a nested exchange carries no goal', () => {
  assert.deepEqual(branchGoalErrors(onMission(), req('workspace.bind', { prerequisite: '2/1' }, { step: 1 })), []);
  assert.ok(branchGoalErrors(onMission(), req('workspace.bind', { prerequisite: '7/1' }, { step: 1 })).some((e) => e.includes('7/1') && e.includes('does not record')));
  assert.ok(branchGoalErrors(onMission(), req('workspace.bind', { prerequisite: '1/1' }, { step: 1 })).some((e) => e.includes('itself')));
  assert.deepEqual(branchGoalErrors(onMission(), req('architecture.decide', undefined, { exchange: 'critique' })), []);
  assert.ok(branchGoalErrors(onMission(), req('architecture.decide', { doneWhen: 0 }, { exchange: 'critique' })).some((e) => e.includes('nested exchange carries no goal')));
});
test('the request gate requires the goal on a mission branch and accepts a lawful one', async () => {
  await fixture(async ({ branch, state, request, save }) => {
    state.mission = mission(); state.choices = { [goalDecisionId('mission', 1)]: choice() }; save();
    assert.ok((await validateRequest(root, branch, packages)).errors.some((e) => e.includes('names its goal')));
    request.goal = { doneWhen: 0 }; save();
    assert.ok((await validateRequest(root, branch, packages)).errors.some((e) => e.includes('produced by interface.audit, not by workspace.bind')));
    request.goal = { prerequisite: '1/1' }; save();
    assert.deepEqual((await validateRequest(root, branch, packages)).errors, []);
    request.goal = { doneWhen: 0, prerequisite: '1/1' }; save();
    assert.ok((await validateRequest(root, branch, packages)).errors.some((e) => e.includes('goal') && e.includes('no unique allowed schema branch')));
  });
});

// Isolated only sees inputs: a context alias the Context table does not cover cannot be read, and a missing required input is not to be found.
test('a Context row covers a request alias by prefix, with each <placeholder> standing for one segment', () => {
  assert.ok(contextCovers('@knowledge/ui/proof', '@knowledge/ui/proof'));
  assert.ok(contextCovers('@knowledge/ui/proof', '@knowledge/ui/proof/rules'));
  assert.ok(contextCovers('@knowledge/grammars/<family>', '@knowledge/grammars/heroui'));
  assert.ok(!contextCovers('@knowledge/ui/proof', '@knowledge/ui/proofs'));
  assert.ok(!contextCovers('@knowledge/grammars/<family>', '@knowledge/grammars'));
  assert.ok(!contextCovers('@workspaces/fe', '@workspaces/be'));
});
test('an isolated operator refuses a context alias its Context table does not cover; other modes do not', () => {
  const table = { rows: [{ alias: '`@knowledge/ui/proof`' }, { alias: '`@knowledge/grammars/<family>`' }] };
  const isolated = { manifest: { id: 'x.y', resources: { mode: 'isolated' } }, en: { tables: { context: table } } };
  const contexts = [{ alias: '@knowledge/grammars/heroui', head: null }, { alias: '@workspaces/be', head: null }];
  const errors = isolatedContextErrors(isolated, { contexts });
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('contexts[1].alias @workspaces/be') && errors[0].includes('reads only the aliases its Context table declares'));
  assert.deepEqual(isolatedContextErrors({ ...isolated, manifest: { id: 'x.y', resources: { mode: 'dispatch' } } }, { contexts }), []);
  assert.deepEqual(isolatedContextErrors(isolated, { contexts: [] }), []);
});
test('the request gate names isolation when an isolated operator lacks a required input or reads outside its Context table', async () => {
  const isolatedOps = packages.filter((p) => p.shape === 'v9' && p.manifest.resources?.mode === 'isolated' && (p.en.tables.inputs?.rows ?? []).some((r) => /yes/i.test(r.required)));
  assert.ok(isolatedOps.length > 0, 'an isolated operator with a required input exists');
  const target = isolatedOps[0];
  await fixture(async ({ branch, request, save }) => {
    request.operatorId = target.manifest.id; request.requirements = {}; request.contexts = [{ alias: '@no-such-zone/anything', head: null }]; save();
    const errors = (await validateRequest(root, branch, packages)).errors;
    assert.ok(errors.some((e) => e.includes('required input') && e.includes('runs isolated and sees only what request.json names')));
    assert.ok(errors.some((e) => e.includes('contexts[0].alias @no-such-zone/anything')));
  });
});

// goalCheck: the receipt answers the branch goal with files it declares.
function branchFixture(run) {
  const dir = mkdtempSync(path.join(tmpdir(), 'goalcheck-'));
  mkdirSync(path.join(dir, 'response', 'data'), { recursive: true });
  writeFileSync(path.join(dir, 'response', 'response.md'), '# receipt\n');
  writeFileSync(path.join(dir, 'response', 'data', 'gates.json'), '{}');
  try { return run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('a done response that serves a done-when line carries goalCheck; evidence is declared, present, and achieved needs one', () => {
  branchFixture((dir) => {
    const fields = { receipt: 'response/response.md', gates: ['response/data/gates.json'] };
    const done = (goalCheck) => ({ status: 'done', fields, ...(goalCheck ? { goalCheck } : {}) });
    assert.ok(goalCheckErrors(dir, done(), { doneWhen: 0 }).some((e) => e.includes('carries goalCheck')));
    assert.deepEqual(goalCheckErrors(dir, done(), { prerequisite: '1/1' }), []);
    assert.deepEqual(goalCheckErrors(dir, { status: 'blocked', fields }, { doneWhen: 0 }), []);
    assert.deepEqual(goalCheckErrors(dir, done({ achieved: true, evidence: ['response/data/gates.json'] }), { doneWhen: 0 }), []);
    assert.deepEqual(goalCheckErrors(dir, done({ achieved: false, evidence: [] }), { doneWhen: 0 }), []);
    assert.ok(goalCheckErrors(dir, done({ achieved: true, evidence: [] }), { doneWhen: 0 }).some((e) => e.includes('achieved is true with no evidence')));
    assert.ok(goalCheckErrors(dir, done({ achieved: true, evidence: ['response/data/invented.json'] }), { doneWhen: 0 }).some((e) => e.includes('not a file this response\'s fields declare')));
    const missing = { ...fields, gone: 'response/data/gone.json' };
    assert.ok(goalCheckErrors(dir, { status: 'done', fields: missing, goalCheck: { achieved: true, evidence: ['response/data/gone.json'] } }, { doneWhen: 0 }).some((e) => e.includes('named as goalCheck evidence but missing')));
    assert.ok(goalCheckErrors(dir, done({ achieved: true, evidence: ['response/data/gates.json'] }), { doneWhen: 0 }, { exchange: 'critique' }).some((e) => e.includes('nested exchange carries no goalCheck')));
  });
});
test('the response gate reads the branch goal from request.json when the caller passed none', async () => {
  const session = mkdtempSync(path.join(tmpdir(), 'goalcheck-'));
  const branch = path.join(session, 'step-2/parallel-1');
  mkdirSync(path.join(branch, 'request'), { recursive: true });
  mkdirSync(path.join(branch, 'response'), { recursive: true });
  const request = { schemaVersion: 9, operatorId: 'workspace.bind', step: 2, parallel: 1, sessionId: 's', contexts: [], requirements: {}, inputs: {}, resume: null, goal: { doneWhen: 0 } };
  const response = { schemaVersion: 9, operatorId: 'workspace.bind', step: 2, parallel: 1, status: 'done', fields: {}, fallbacks: [], commits: [], next: [] };
  try {
    writeFileSync(path.join(branch, 'request/request.json'), JSON.stringify(request));
    writeFileSync(path.join(branch, 'response/response.json'), JSON.stringify(response));
    assert.ok((await validateResponse(root, branch)).errors.some((e) => e.includes('serves mission doneWhen 0') && e.includes('carries goalCheck')));
    writeFileSync(path.join(branch, 'response/response.json'), JSON.stringify({ ...response, goalCheck: { achieved: true, evidence: ['response/data/invented.json'] } }));
    assert.ok((await validateResponse(root, branch)).errors.some((e) => e.includes('goalCheck.evidence response/data/invented.json')));
    assert.ok(!(await validateResponse(root, branch, { goal: null })).errors.some((e) => e.includes('carries goalCheck')));
  } finally { rmSync(session, { recursive: true, force: true }); }
});
