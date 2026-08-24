import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextState } from './route-machine.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const machine = (id) => JSON.parse(readFileSync(path.join(root, id, 'machine.json'), 'utf8'));

const backend = machine('starci-backend-delivery');
assert.equal(nextState(backend, 'analyze-input', {}, { mode: 'deliver', options: {} }), 'route');
assert.equal(nextState(backend, 'architecture-choice', {}, { options: { architectureMode: 'required' } }), 'architecture-frame');
assert.equal(nextState(backend, 'architecture-choice', {}, { options: { architectureMode: 'skip' } }), 'source-discovery');
assert.equal(nextState(backend, 'architecture-challenge', { payload: { decision: 'revise' } }, {}), 'architecture-alternatives');

const frontend = machine('starci-frontend-design-delivery');
assert.equal(nextState(frontend, 'analyze-input', {}, { mode: 'feedback', options: {} }), 'maintenance-apply');
assert.equal(nextState(frontend, 'request-choice', { facts: ['grammar-gap', 'create-required'] }, {}), 'requests');
assert.equal(nextState(frontend, 'request-choice', { facts: [] }, {}), 'implementation');

const deployment = machine('starci-deployment');
assert.equal(nextState(deployment, 'monitor', { payload: { decision: 'recover' } }, {}), 'recover');
assert.equal(nextState(deployment, 'recover', { payload: { decision: 'retry' } }, {}), 'monitor');

assert.throws(
  () => nextState({ id: 'ambiguous', states: { start: { kind: 'choice', on: [
    { when: {}, target: 'a' }, { when: {}, target: 'b' }
  ] } } }, 'start', {}, {}),
  /expected one route, matched 2/
);

console.log('state-machine routing tests passed');
