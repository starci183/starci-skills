import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { selectWorkflowTopology, sessionWorkflowTopologyErrors, workflowTopologyPolicyErrors } from './workflow-topology.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = JSON.parse(readFileSync(path.join(root, 'resources', 'orchestrator.json'), 'utf8')).workflowTopologies;
const stateSchema = JSON.parse(readFileSync(path.join(root, 'templates', 'step', 'state.schema.json'), 'utf8'));

test('user demand selects exactly solo or coordinated above operator execution modes', () => {
  assert.deepEqual(workflowTopologyPolicyErrors(policy), []);
  assert.deepEqual(Object.keys(policy.modes).sort(), ['coordinated', 'solo']);
  assert.deepEqual(policy.sources, ['tests/evidence/20260906-workflow-topologies-public.md']);
  assert.deepEqual(selectWorkflowTopology(policy), { mode: 'solo' });
  assert.deepEqual(selectWorkflowTopology(policy, { mode: 'coordinated' }), { mode: 'coordinated' });
  for (const mode of ['controller', 'isolated', 'dispatch']) assert.throws(() => selectWorkflowTopology(policy, { mode }), /unknown/);
  assert.throws(() => selectWorkflowTopology(policy, {}), /mode is required/);
  assert.throws(() => selectWorkflowTopology(policy, { mode: 'solo', extra: true }), /only mode/);
});

test('coordinated topology uses ordinary messages and requires peer heads only when closing', () => {
  const coordinated = policy.modes.coordinated;
  assert.equal(coordinated.communication, 'ordinary-two-way-task-messages');
  assert.equal(policy.tracking, 'state.json#brief.peers');
  assert.match(coordinated.communicationRule, /messages are sufficient/i);
  assert.match(coordinated.communicationRule, /proves nothing/i);
  assert.match(coordinated.completion, /unchanged local mission receipt gate/i);
  assert.match(coordinated.completion, /no cross-session message envelope or receipt import/i);

  const state = { topology: { mode: 'coordinated' }, hostBinding: { hostId: 'task-coordinator' }, brief: { peers: {} } };
  assert.ok(sessionWorkflowTopologyErrors(policy, state, { dispatch: true }).some((error) => error.includes('at least 2 peer tasks')));
  state.brief.peers = {
    'task-accounting': { owns: 'accounting', head: null },
    'task-chatbot': { owns: 'chatbot', head: null }
  };
  assert.deepEqual(sessionWorkflowTopologyErrors(policy, state, { dispatch: true }), []);
  assert.ok(sessionWorkflowTopologyErrors(policy, state, { terminal: true }).every((error) => error.includes('requires a recorded peer head')));
  state.brief.peers['task-accounting'].head = 'abcdef0';
  state.brief.peers['task-chatbot'].head = '1234567';
  assert.deepEqual(sessionWorkflowTopologyErrors(policy, state, { terminal: true }), []);

  const soloWithPeers = { ...state, topology: { mode: 'solo' } };
  assert.ok(sessionWorkflowTopologyErrors(policy, soloWithPeers).some((error) => error.includes('at most 0 peer tasks')));
  state.brief.peers['task-chatbot'].owns = 'accounting';
  assert.ok(sessionWorkflowTopologyErrors(policy, state).some((error) => error.includes('distinct non-empty owns')));
  state.brief.peers['task-chatbot'].owns = 'chatbot';
  state.brief.peers['task-coordinator'] = { owns: 'controller', head: '7654321' };
  assert.ok(sessionWorkflowTopologyErrors(policy, state).some((error) => error.includes('own hostBinding.hostId')));
  const emptyPeer = structuredClone(state);
  emptyPeer.brief.peers[''] = { owns: 'empty', head: null };
  assert.ok(validateAgainst(stateSchema, emptyPeer, 'state.json').some((error) => error.includes('string is too short')));

  const malformedPeer = structuredClone(state);
  malformedPeer.brief.peers['task-accounting'] = { owns: 7, head: 1234567 };
  let malformedErrors;
  assert.doesNotThrow(() => { malformedErrors = sessionWorkflowTopologyErrors(policy, malformedPeer, { terminal: true }); });
  assert.ok(malformedErrors.some((error) => error.includes('owns: expected string')));
  assert.ok(malformedErrors.some((error) => error.includes('head: expected string|null')));
  assert.ok(malformedErrors.some((error) => error.includes('requires a recorded peer head')));
});

test('older v2.2 state is read-only until migration and malformed policy returns errors', () => {
  assert.deepEqual(sessionWorkflowTopologyErrors(policy, { workflow: null, brief: { peers: {} } }), []);
  assert.ok(sessionWorkflowTopologyErrors(policy, { workflow: null, brief: { peers: {} } }, { dispatch: true }).some((error) => error.includes('reopen the host session to migrate')));
  assert.ok(sessionWorkflowTopologyErrors(policy, { workflow: null, brief: { peers: {} } }, { terminal: true }).some((error) => error.includes('reopen the host session to migrate')));
  assert.ok(sessionWorkflowTopologyErrors(policy, { topology: { mode: 'controller' }, brief: { peers: {} } }).some((error) => error.includes('not declared')));
  const mutated = structuredClone(policy);
  delete mutated.modes.coordinated.minimumPeers;
  assert.ok(workflowTopologyPolicyErrors(mutated).some((error) => error.includes('minimumPeers')));
  assert.doesNotThrow(() => sessionWorkflowTopologyErrors(mutated, { topology: { mode: 'coordinated' }, brief: { peers: {} } }, { dispatch: true }));
  const impossibleAddress = structuredClone(policy);
  impossibleAddress.state = 'state.json#custom.mode';
  impossibleAddress.tracking = 'state.json#custom.peers';
  assert.ok(workflowTopologyPolicyErrors(impossibleAddress).some((error) => error.includes('not declared by templates/step/state.schema.json')));
  const wrongAddressTypes = structuredClone(policy);
  wrongAddressTypes.state = policy.tracking;
  wrongAddressTypes.tracking = policy.state;
  const wrongTypeErrors = workflowTopologyPolicyErrors(wrongAddressTypes);
  assert.ok(wrongTypeErrors.some((error) => error.includes('state must resolve to a string schema')));
  assert.ok(wrongTypeErrors.some((error) => error.includes('tracking must resolve to an object schema')));
});

test('coordinated topology accepts distinct full repository heads while retaining legacy head state', () => {
  const state = {
    topology: { mode: 'coordinated' },
    hostBinding: { hostId: 'task-coordinator' },
    brief: { peers: {
      'task-accounting': { owns: 'accounting', head: null, heads: [
        { alias: '@workspaces/be', head: 'a'.repeat(40) },
        { alias: '@workspaces/fe', head: 'b'.repeat(40) }
      ] },
      'task-chatbot': { owns: 'chatbot', head: null, heads: [
        { alias: '@workspaces/be', head: 'c'.repeat(40) },
        { alias: '@workspaces/fe', head: 'd'.repeat(40) }
      ] }
    } }
  };
  assert.deepEqual(sessionWorkflowTopologyErrors(policy, state, { terminal: true }), []);
  const duplicate = structuredClone(state);
  duplicate.brief.peers['task-chatbot'].heads[1].alias = '@workspaces/be';
  assert.ok(sessionWorkflowTopologyErrors(policy, duplicate, { terminal: true }).some(error => error.includes('distinct routed workspace alias')));
  const short = structuredClone(state);
  short.brief.peers['task-chatbot'].heads[1].head = 'abcdef0';
  assert.ok(sessionWorkflowTopologyErrors(policy, short, { terminal: true }).some(error => error.includes('repository head set')));
});
