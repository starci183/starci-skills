// The mission's goal is confirmed by the person before anything runs: scripts/validate-request.mjs#missionGateErrors.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { EFFECT_TOOLS, operatorEffects, missionTouchesRuntime, missionGateErrors, goalDecisionId, validateRequest } from './validate-request.mjs';
import { loadOperatorPackages } from './operator-md.mjs';
import { loadInteractionPolicy } from './validate-interaction.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = await loadOperatorPackages(root);
const policy = await loadInteractionPolicy(root);
const tools = JSON.parse(await readFile(path.join(root, 'resources/tools.json'), 'utf8')).tools;
const pkg = (id) => packages.find((p) => p.manifest.id === id);
const mission = (version = 1, doneWhen = [{ evidence: 'the served head passes its audit', producedBy: 'frontend.surface.audit' }]) => ({ version, language: 'en', goal: 'the interview stands alone', includes: ['the interview page'], excludes: ['the course'], doneWhen, sourceRef: 'user-message:goal' });
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
  for (const id of ['workspace.bind', 'quality.verify', 'frontend.presentation.resolve', 'architecture.decide']) assert.deepEqual(operatorEffects(pkg(id)), [], id);
  assert.ok(operatorEffects(pkg('backend.source.apply')).some((t) => t.id === 'sourcewrite'));
  assert.ok(operatorEffects(pkg('git.publish')).some((t) => t.id === 'git' && t.mode !== 'read'));
  assert.ok(operatorEffects(pkg('frontend.surface.audit')).some((t) => t.id === 'browsercontrol'));
  assert.ok(operatorEffects(pkg('frontend.direction.decide')).some((t) => t.id === 'host'));
  assert.equal(missionTouchesRuntime(['workspace.bind', 'quality.verify'], packages), false);
  assert.equal(missionTouchesRuntime(['workspace.bind', 'uat.verify'], packages), true);
  assert.equal(missionTouchesRuntime(['no.such.operator'], packages), false);
  // The decision is made from tools, so a manifest that gains an effect tool needs the confirmation without a list changing.
  assert.equal(missionTouchesRuntime(['x.y'], [{ manifest: { id: 'x.y', resources: { tools: { '@tools/database': 'namespaced-write' } } } }]), true);
  assert.equal(missionTouchesRuntime(['x.y'], [{ manifest: { id: 'x.y', resources: { tools: { '@tools/database': 'read', '@tools/container': 'read' } } } }]), false);
});
test('the gate applies only to a live session or one that already carries a mission, like brief and budget', () => {
  assert.deepEqual(missionGateErrors({ id: 's', steps: { '1/1': 'backend.source.apply' } }, null, packages, policy), []);
  assert.deepEqual(missionGateErrors({ id: 's', steps: { '1/1': 'backend.source.apply' }, transitions: [] }, { operatorId: 'backend.source.apply' }, packages, policy), []);
  assert.ok(goal(missionGateErrors(live({ '1/1': 'backend.source.apply' }), null, packages, policy)).length);
  assert.ok(goal(missionGateErrors({ id: 's', steps: { '1/1': 'backend.source.apply' }, mission: mission() }, null, packages, policy)).some((e) => e.includes('choices[')));
  assert.deepEqual(missionGateErrors(null, null, packages, policy), []);
});
test('read-only work asks nothing; the request operator counts beside the recorded steps', () => {
  assert.deepEqual(missionGateErrors(live({ '1/1': 'workspace.bind' }), { operatorId: 'quality.verify', sessionId: 's' }, packages, policy), []);
  const errors = goal(missionGateErrors(live({ '1/1': 'workspace.bind' }), { operatorId: 'frontend.source.apply', sessionId: 's' }, packages, policy));
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
  const steps = { '1/1': 'frontend.source.apply' };
  const stale = goal(missionGateErrors(live(steps, { mission: mission(2), choices: { [goalDecisionId('s', 1)]: choice() } }), null, packages, policy));
  assert.ok(stale.some((e) => e.includes(goalDecisionId('s', 2))));
  const current = live(steps, { mission: mission(2), choices: { [goalDecisionId('s', 1)]: choice('corrected'), [goalDecisionId('s', 2)]: choice() } });
  assert.deepEqual(missionGateErrors(current, null, packages, policy), []);
});
test('every done-when line names an operator that exists', () => {
  const steps = { '1/1': 'frontend.source.apply' };
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
  const state = { id: 'mission', project: 'example', startedAt: '2026-09-04', status: 'running', chain: [['1/1'], ['2/1']], steps: { '1/1': 'frontend.source.apply', '2/1': 'workspace.bind' }, current: '2/1', requestHashes: {}, transitions: [{ at: 'now', branch: '1/1', event: 'dispatched' }], brief, budget: { maxSteps: 24, maxSameOperator: 4 } };
  const request = { schemaVersion: 9, operatorId: 'workspace.bind', step: 2, parallel: 1, sessionId: 'mission', contexts: [], requirements: { project: 'example', role: 'fe' }, inputs: {}, resume: null };
  const save = () => { writeFileSync(path.join(session, 'state.json'), JSON.stringify(state)); writeFileSync(path.join(branch, 'request/request.json'), JSON.stringify(request)); };
  try { await run({ branch, state, save }); } finally { rmSync(session, { recursive: true, force: true }); }
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
