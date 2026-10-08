import test from 'node:test';
import assert from 'node:assert/strict';
import { withKernelIngress } from '../helpers/kernel-ingress-fixture.mjs';
import { callerAdmission } from '../../scripts/kernel/caller-admission.mjs';
import { personActor, INTERVENTION_EVENT } from '../../scripts/kernel/intervention.mjs';

const MARKERS = ['STARCI_ACTOR', 'STARCI_API_CHILD', 'STARCI_CALLER'];
const cleanEnv = (extra = {}) => {
  const env = { ...process.env, ...extra };
  for (const name of MARKERS) if (!(name in extra)) delete env[name];
  return env;
};
const write = (w, kind = 'probe') => w.ledger.transaction(() => w.ledger.appendEvent({ workflowId: w.workflowId, entityType: 'workflow', entityId: w.workflowId, kind, payload: {} }));
const interventions = (w) => w.ledger.db.prepare('SELECT payload_json FROM events WHERE kind=?').all(INTERVENTION_EVENT).map((r) => JSON.parse(r.payload_json));

test('a person at a shell is noted once per call, however many transactions the call opens', (t) => withKernelIngress(t, (w) => {
  const admitted = callerAdmission(w.ledger, { workflow: w.workflowId }, { env: cleanEnv(), root: w.runtime, verb: 'enqueue' });
  admitted.run(() => { write(w); write(w); });
  assert.deepEqual(interventions(w), [{ actor: 'person', via: 'unbound', verb: 'enqueue' }]);
}));

test('a child of the reconciler, the settler or an api verb is not a person', (t) => withKernelIngress(t, (w) => {
  for (const marker of [{ STARCI_ACTOR: 'reconciler/job' }, { STARCI_CALLER: 'runtime-settler' }, { STARCI_API_CHILD: '1' }]) {
    callerAdmission(w.ledger, { workflow: w.workflowId }, { env: cleanEnv(marker), root: w.runtime, verb: 'settle' }).run(() => write(w));
  }
  assert.deepEqual(interventions(w), []);
}));

test('the current Kernel seat is not a person', (t) => withKernelIngress(t, (w) => {
  callerAdmission(w.ledger, { workflow: w.workflowId }, { env: cleanEnv({ ORCA_TERMINAL_HANDLE: w.handle }), root: w.runtime, verb: 'dispatch' }).run(() => write(w));
  assert.deepEqual(interventions(w), []);
}));

test('a call that opens no write, or names no workflow, leaves no event and the write still lands', (t) => withKernelIngress(t, (w) => {
  callerAdmission(w.ledger, { workflow: w.workflowId }, { env: cleanEnv(), root: w.runtime, verb: 'status' }).run(() => w.ledger.db.prepare('SELECT 1').get());
  callerAdmission(w.ledger, {}, { env: cleanEnv(), root: w.runtime, verb: 'log' }).run(() => write(w, 'landed'));
  assert.deepEqual(interventions(w), []);
  assert.equal(w.ledger.db.prepare("SELECT count(*) AS n FROM events WHERE kind='landed'").get().n, 1);
}));

test('only an unbound owner can be a person', () => {
  assert.equal(personActor({ role: 'kernel', via: 'terminal-handle' }, cleanEnv()), null);
  assert.equal(personActor({ role: 'owner', via: 'unbound' }, {}).actor, 'person');
  assert.equal(personActor({ role: 'owner', via: 'unbound' }, { STARCI_ACTOR: 'supervisor' }), null);
});
