// The unit of a blind agent is one page, one modal, one flow: scripts/validate-request.mjs#unitGateErrors,
// #unitsErrors, #loadUnits and #planOperatorOf, and the `unit` field of templates/step/request.schema.json.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { unitsErrors, loadUnits, planOperatorOf, producesUnits, domainOfId, unitGateErrors, validateRequest, goalDecisionId } from './validate-request.mjs';
import { loadOperatorPackages } from './operator-md.mjs';
import { validateAgainst } from './json-schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = await loadOperatorPackages(root);
const orchestrator = JSON.parse(await readFile(path.join(root, 'resources/orchestrator.json'), 'utf8'));
const requestSchema = JSON.parse(await readFile(path.join(root, 'templates/step/request.schema.json'), 'utf8'));
const unit = (id, extra = {}) => ({ id, kind: 'flow', goal: `a viewer walks ${id}`, inputs: [], dependsOn: [], ...extra });
const plan = (units, producedBy = 'uat.plan') => ({ schemaVersion: 9, producedBy, units });
const mission = (doneWhen) => ({ version: 1, language: 'en', goal: 'two journeys are walked', includes: ['both flows'], excludes: [], doneWhen, sourceRef: 'user-message:goal' });
const lines = (n, producedBy = 'uat.verify') => Array.from({ length: n }, (_, i) => ({ evidence: `flow ${i + 1} walked`, producedBy }));
const onMission = (n = 2, producedBy) => ({ id: 's', mission: mission(lines(n, producedBy)), steps: { '1/1': 'uat.plan' } });
const req = (operatorId, extra = {}) => ({ operatorId, step: 2, parallel: 1, sessionId: 's', inputs: {}, ...extra });
const gate = (errors) => errors.filter((e) => /one unit per branch|is not an id of|names no plan|not produced earlier|maxParallel|producedBy|units\.json/.test(e));

test('the orchestrator declares the fan-out cap and the per-unit budget', () => {
  assert.ok(Number.isInteger(orchestrator.concurrency.maxParallel) && orchestrator.concurrency.maxParallel >= 1 && orchestrator.concurrency.maxParallel <= orchestrator.maxConcurrentAgents);
  assert.ok(Number.isInteger(orchestrator.budget.perUnit) && orchestrator.budget.perUnit >= 1);
  assert.ok(orchestrator.budget.note.includes('perUnit'));
});
test('request.json may carry one unit id, and nothing else in its shape', () => {
  const base = { schemaVersion: 9, operatorId: 'uat.verify', step: 2, parallel: 1, sessionId: 's', contexts: [], requirements: {}, inputs: {}, resume: null };
  assert.deepEqual(validateAgainst(requestSchema, { ...base, unit: 'open-item' }), []);
  assert.ok(validateAgainst(requestSchema, { ...base, unit: 'Open Item' }).length);
  assert.ok(validateAgainst(requestSchema, { ...base, unit: ['open-item'] }).length);
});
test('units relations: ids are unique, dependsOn resolves within the file, and nothing depends on itself', () => {
  assert.deepEqual(unitsErrors(plan([unit('a'), unit('b', { dependsOn: ['a'] })])), []);
  assert.ok(unitsErrors(plan([unit('a'), unit('a')])).some((e) => e.includes('unit a is declared twice')));
  assert.ok(unitsErrors(plan([unit('a', { dependsOn: ['z'] })])).some((e) => e.includes('depends on z, which this file does not declare')));
  assert.ok(unitsErrors(plan([unit('a', { dependsOn: ['a'] })])).some((e) => e.includes('depends on itself')));
  assert.deepEqual(unitsErrors(null), []);
});
test('loadUnits reads the file against its schema and then the relations', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'units-'));
  try {
    const file = path.join(dir, 'units.json');
    writeFileSync(file, JSON.stringify(plan([unit('a'), unit('b', { dependsOn: ['a'] })])));
    assert.equal((await loadUnits(root, file)).errors.length, 0);
    writeFileSync(file, JSON.stringify(plan([unit('a', { goal: '' })])));
    assert.ok((await loadUnits(root, file)).errors.some((e) => e.includes('goal')));
    writeFileSync(file, JSON.stringify(plan([unit('a', { kind: 'screen' })])));
    assert.equal((await loadUnits(root, file)).units, null);
    writeFileSync(file, JSON.stringify(plan([unit('a'), unit('a')])));
    assert.ok((await loadUnits(root, file)).errors.some((e) => e.includes('declared twice')));
    writeFileSync(file, '{');
    assert.equal((await loadUnits(root, file)).units, null);
    assert.ok((await loadUnits(root, path.join(dir, 'none.json'))).errors.some((e) => e.includes('missing')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('the plan operator of a domain is <domain>.plan, and it is one whose Outputs declare units', () => {
  assert.equal(domainOfId('uat.verify'), 'uat');
  assert.equal(domainOfId('backend.generate'), 'backend');
  assert.equal(planOperatorOf('uat.verify', packages)?.manifest.id, 'uat.plan');
  assert.equal(planOperatorOf('interface.generate', packages)?.manifest.id, 'interface.plan');
  assert.equal(planOperatorOf('git.publish', packages), null);
  assert.ok(producesUnits(packages.find((p) => p.manifest.id === 'uat.plan')));
  assert.ok(!producesUnits(packages.find((p) => p.manifest.id === 'uat.verify')));
  // A <domain>.plan that does not declare units is not a plan operator.
  const fake = [{ manifest: { id: 'x.plan' }, en: { tables: { outputs: { rows: [{ kind: '`receipt`' }] } } } }];
  assert.equal(planOperatorOf('x.run', fake), null);
});
test('the gate applies only on a mission, never to an exchange, and never asks a plan operator for a unit', async () => {
  assert.deepEqual(await unitGateErrors(root, { id: 's', steps: {} }, req('uat.verify'), packages, null), []);
  assert.deepEqual(await unitGateErrors(root, null, req('uat.verify'), packages, null), []);
  assert.deepEqual(await unitGateErrors(root, onMission(3), req('uat.verify', { exchange: 'critique' }), packages, null), []);
  assert.deepEqual(await unitGateErrors(root, onMission(3, 'uat.plan'), req('uat.plan'), packages, null), []);
});
test('an execute operator with several done-when lines and a plan operator fans out one unit per branch', async () => {
  const refused = await unitGateErrors(root, onMission(2), req('uat.verify'), packages, null);
  assert.equal(refused.length, 1);
  assert.ok(refused[0].includes('uat.verify runs one unit per branch') && refused[0].includes('2 done-when lines') && refused[0].includes('uat.plan exists') && refused[0].includes('inputs.units'));
  assert.deepEqual(await unitGateErrors(root, onMission(1), req('uat.verify'), packages, null), []);
  // An operator whose domain has no plan operator is never asked for a unit.
  assert.deepEqual(await unitGateErrors(root, onMission(3, 'git.publish'), req('git.publish'), packages, null), []);
});
test('a unit resolves through inputs.units to a plan an earlier branch produced, within the fan-out cap', async () => {
  const session = mkdtempSync(path.join(tmpdir(), 'unit-gate-'));
  try {
    const producer = path.join(session, 'step-1/parallel-1/response/data');
    mkdirSync(producer, { recursive: true });
    const write = (doc) => writeFileSync(path.join(producer, 'units.json'), JSON.stringify(doc));
    write(plan([unit('open-item'), unit('remove-item', { dependsOn: ['open-item'] })]));
    const state = onMission(2);
    const bound = { units: 'step-1/parallel-1/response/data/units.json' };
    assert.deepEqual(await unitGateErrors(root, state, req('uat.verify', { unit: 'open-item', inputs: bound }), packages, session), []);
    assert.deepEqual(await unitGateErrors(root, state, req('uat.verify', { unit: 'remove-item', parallel: orchestrator.concurrency.maxParallel, inputs: bound }), packages, session), []);
    assert.ok((await unitGateErrors(root, state, req('uat.verify', { unit: 'archive-item', inputs: bound }), packages, session)).some((e) => e.includes('unit archive-item is not an id of') && e.includes('open-item, remove-item')));
    assert.ok((await unitGateErrors(root, state, req('uat.verify', { unit: 'open-item' }), packages, session)).some((e) => e.includes('names no plan')));
    assert.ok((await unitGateErrors(root, state, req('uat.verify', { unit: 'open-item', inputs: { units: 'step-1/parallel-1/response/response.md' } }), packages, session)).some((e) => e.includes('names no plan')));
    assert.ok((await unitGateErrors(root, state, req('uat.verify', { unit: 'open-item', step: 1, inputs: bound }), packages, session)).some((e) => e.includes('not produced earlier than step 1')));
    assert.ok((await unitGateErrors(root, state, req('uat.verify', { unit: 'open-item', parallel: orchestrator.concurrency.maxParallel + 1, inputs: bound }), packages, session)).some((e) => e.includes('passes concurrency.maxParallel')));
    write(plan([unit('open-item')], 'git.publish'));
    assert.ok((await unitGateErrors(root, state, req('uat.verify', { unit: 'open-item', inputs: bound }), packages, session)).some((e) => e.includes('producedBy git.publish is not an operator whose Outputs declare units')));
    write(plan([unit('open-item'), unit('open-item')]));
    assert.ok((await unitGateErrors(root, state, req('uat.verify', { unit: 'open-item', inputs: bound }), packages, session)).some((e) => e.includes('declared twice')));
    assert.ok((await unitGateErrors(root, state, req('uat.verify', { unit: 'open-item', inputs: { units: 'step-1/parallel-2/response/data/units.json' } }), packages, session)).some((e) => e.includes('missing')));
  } finally { rmSync(session, { recursive: true, force: true }); }
});
// The request gate runs the unit gate on a live mission session: an execute branch without its unit is refused, one with it passes.
test('the request gate refuses a fan-out branch without its unit and accepts one that names a planned unit', async () => {
  const session = mkdtempSync(path.join(tmpdir(), 'unit-gate-'));
  try {
    const branch = path.join(session, 'step-2/parallel-1');
    mkdirSync(path.join(branch, 'request'), { recursive: true });
    mkdirSync(path.join(session, 'step-1/parallel-1/response/data'), { recursive: true });
    writeFileSync(path.join(session, 'step-1/parallel-1/response/data/units.json'), JSON.stringify(plan([unit('open-item'), unit('remove-item')])));
    const state = { id: 'mission', project: 'example', startedAt: '2026-09-05', status: 'running', chain: [['1/1'], ['2/1']], steps: { '1/1': 'uat.plan', '2/1': 'uat.verify' }, current: '2/1', requestHashes: {}, mission: mission(lines(2)), choices: { [goalDecisionId('mission', 1)]: { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user-message:answer' } } };
    const request = { schemaVersion: 9, operatorId: 'uat.verify', step: 2, parallel: 1, sessionId: 'mission', contexts: [], requirements: {}, inputs: {}, resume: null, goal: { doneWhen: 0 } };
    const save = () => { writeFileSync(path.join(session, 'state.json'), JSON.stringify(state)); writeFileSync(path.join(branch, 'request/request.json'), JSON.stringify(request)); };
    save();
    assert.ok(gate((await validateRequest(root, branch, packages)).errors).some((e) => e.includes('uat.verify runs one unit per branch')));
    request.unit = 'open-item'; request.inputs = { units: 'step-1/parallel-1/response/data/units.json' }; save();
    assert.deepEqual(gate((await validateRequest(root, branch, packages)).errors), []);
    request.unit = 'archive-item'; save();
    assert.ok(gate((await validateRequest(root, branch, packages)).errors).some((e) => e.includes('unit archive-item is not an id of')));
    // A bare session carries no mission and asks nothing, exactly as the other mission gates.
    delete state.mission; delete state.choices; delete request.unit; delete request.goal; request.inputs = {}; save();
    assert.deepEqual(gate((await validateRequest(root, branch, packages)).errors), []);
  } finally { rmSync(session, { recursive: true, force: true }); }
});
