import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextState } from './route-machine.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const machine = (id) => JSON.parse(readFileSync(path.join(root, id, 'machine.json'), 'utf8'));

const backend = machine('starci-backend-delivery');
assert.equal(nextState(backend, 'analyze-input', {}, { selection: { skillId: 'starci-backend-delivery' }, options: {} }), 'route');
assert.equal(nextState(backend, 'route', { payload: { decision: 'ready' } }, {}), 'business-staleness');
assert.equal(nextState(backend, 'business-staleness', { payload: { decision: 'initialize-required' } }, {}), 'business-evidence');
assert.equal(nextState(backend, 'business-staleness', { payload: { decision: 'fresh' } }, {}), 'architecture-frame');
assert.equal(nextState(backend, 'architecture-challenge', { payload: { decision: 'revise' } }, {}), 'architecture-alternatives');
assert.equal(nextState(backend, 'boundary-approval', { stage: 'architecture.boundary.review', status: 'approved' }, {}), 'coding-scope');

const backendRepair = machine('starci-backend-repair');
assert.equal(nextState(backendRepair, 'analyze-input', {}, { selection: { skillId: 'starci-backend-repair' }, options: {} }), 'route');
assert.equal(nextState(backendRepair, 'repair-prerequisites', { payload: { decision: 'ready' } }, {}), 'coding-scope');
assert.equal(nextState(backendRepair, 'repair-prerequisites', { payload: { decision: 'replan-required' } }, {}), 'replan-handoff');
assert.equal(nextState(backendRepair, 'coding-scope', { payload: { decision: 'source-drift' } }, {}), 'replan-handoff');

const frontend = machine('starci-frontend-layout-delivery');
assert.equal(nextState(frontend, 'analyze-input', {}, { selection: { skillId: 'starci-frontend-layout-delivery' }, options: {} }), 'route');
assert.equal(nextState(frontend, 'business-staleness', { payload: { decision: 'fresh' } }, {}), 'preflight');
assert.equal(nextState(frontend, 'journey', { stage: 'flow.review', status: 'pending' }, {}), 'flow-approval');
assert.equal(nextState(frontend, 'journey', { stage: 'flow.review', status: 'approved' }, {}), 'page-model');
assert.equal(nextState(frontend, 'request-choice', { facts: ['grammar-gap', 'create-required'] }, {}), 'requests');
assert.equal(nextState(frontend, 'request-choice', { facts: [] }, {}), 'coding-scope');

const maintenance = machine('starci-frontend-maintenance-apply');
assert.equal(nextState(maintenance, 'analyze-input', {}, { selection: { skillId: 'starci-frontend-maintenance-apply' }, options: {} }), 'maintenance-apply');

const deployment = machine('starci-deployment');
assert.equal(nextState(deployment, 'monitor', { payload: { decision: 'recover' } }, {}), 'recover');
assert.equal(nextState(deployment, 'monitor', { payload: { decision: 'progressing' } }, {}), 'monitor');
assert.equal(nextState(deployment, 'recover', { payload: { decision: 'retry' } }, {}), 'monitor');
assert.equal(nextState(deployment, 'proof', { payload: { decision: 'rolled-back' } }, {}), 'rolled-back');

const debt = machine('starci-quality-debt-repay');
assert.equal(nextState(debt, 'debt', { payload: { decision: 'closure-candidate' } }, {}), 'debt-proof');
assert.equal(nextState(debt, 'debt-proof', { payload: { decision: 'green' } }, {}), 'debt-close');

assert.throws(
  () => nextState({ id: 'ambiguous', states: { start: { kind: 'choice', on: [
    { when: {}, target: 'a' }, { when: {}, target: 'b' }
  ] } } }, 'start', {}, {}),
  /expected one route, matched 2/
);

console.log('state-machine routing tests passed');
