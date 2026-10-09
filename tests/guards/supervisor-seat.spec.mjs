// supervisor-seat.spec.mjs — what the Supervisor seat may run (modules/kernel/command-policy.yaml `supervisor`, scripts/guards/supervisor-seat.mjs).
// A seat started under the old contract tries the verbs it learned from habit: every one is refused WITH its current menu and the
// spelling of the decision verb, so it recovers in one step. Reads, the decision verb, the defect record and the collectors pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCommandPolicy, policyVerdict } from '../../scripts/guards/command-policy.mjs';
import { supervisorSeatVerdict } from '../../scripts/guards/supervisor-seat.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { openDecision } from '../../scripts/machine/decisions.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const POLICY = loadCommandPolicy({ root: ROOT });
const verdict = (program, args) => policyVerdict({ role: 'supervisor', command: { program, args, cwd: ROOT }, policy: POLICY });
const starci = (...args) => verdict('starci', args);

const gate = await openDecision(null, { ledger: 'supervisor', kind: 'runtime-defect', decider: 'supervisor', by: 'reconciler/spec', idempotencyKey: 'runtime-defect:workflow:wf-seat:gate',
  workflowId: 'wf-seat', entity: { type: 'workflow', id: 'wf-seat' }, summary: 'supervisor-gate inc-seat (retry-cap) holds op-a', refs: { gateIncident: 'inc-seat', ledgerId: 'none', cause: 'retry-cap' } });
const GATE_ITEM = `gate-ruling:${gate.json.decision.id}`;

const HABITS = [
  ['a fix worker', ['supervisor', 'workers', 'create', '--cluster', 'c1', '--title', 't'], 'RUNTIME_CHANGE_OWNED_BY_DEBUG'],
  ['a worker spawn', ['supervisor', 'workers', 'spawn'], 'RUNTIME_CHANGE_OWNED_BY_DEBUG'],
  ['a land', ['supervisor', 'land', '--commit', 'abc123', '--lane', 'fix'], 'RUNTIME_CHANGE_OWNED_BY_DEBUG'],
  ['a lesson land', ['supervisor', 'lesson-actions', 'land', '--signature', 's'], 'RUNTIME_CHANGE_OWNED_BY_DEBUG'],
  ['a gate resolved by hand', ['kernel', 'incident', '--workflow', 'wf-seat', '--resolve', 'inc-seat', '--by', 'supervisor', '--resolution', 'fixed', '--commit', 'abc123'], 'SUPERVISOR_USE_DECIDE'],
  ['a Decision Item resolved by hand', ['machine', 'decisions', 'supervisor', '--resolve', 'di-1', '--by', 'supervisor', '--verb', 'x'], 'SUPERVISOR_USE_DECIDE'],
  ['a Decision Item claimed by hand', ['machine', 'decisions', 'supervisor', '--claim', 'di-1', '--by', 'supervisor'], 'SUPERVISOR_USE_DECIDE'],
  ['a notice typed to a Kernel', ['supervisor', 'notify', '--repo', 'r', '--workflow', 'wf-seat', '--text', 'hello'], 'SUPERVISOR_USE_DECIDE'],
  ['a priority set by hand', ['supervisor', 'ram-cap', 'prioritize', '--workflow', 'wf-seat', '--weight', '2'], 'SUPERVISOR_USE_DECIDE'],
  ['an owed action recorded under an owed key', ['supervisor', 'actions', 'record', '--item', 'stalled|wf-seat', '--action', 'woke', '--reason', 'r'], 'SUPERVISOR_USE_DECIDE'],
  ['a Kernel verb that dispatches', ['kernel', 'dispatch-ready', '--workflow', 'wf-seat'], 'SUPERVISOR_USE_DECIDE'],
  ['a Kernel decision claimed', ['kernel', 'decisions', '--workflow', 'wf-seat', '--claim', 'di-1'], 'SUPERVISOR_USE_DECIDE'],
  ['a worker stopped', ['supervisor', 'workers', 'cancel', '--job', 'j1'], 'SUPERVISOR_USE_DECIDE'],
  ['a shell script', ['scripts/supervisor/land.mjs'], 'SUPERVISOR_STARCI_ONLY', 'node'],
  ['a copy', ['a', 'b'], 'SUPERVISOR_STARCI_ONLY', 'cp'],
  ['a network call', ['https://example.test'], 'SUPERVISOR_STARCI_ONLY', 'curl'],
];

for (const [name, args, code, program = 'starci'] of HABITS) {
  test(`${name} is refused with the menu and the decision verb's spelling`, () => {
    const refused = verdict(program, args);
    assert.equal(refused?.code, code);
    const text = refused.remedy;
    assert.match(text, /starci supervisor decide --item <id> --choice <choice> --reason <why>/, 'the decision verb is spelled');
    assert.match(text, new RegExp(GATE_ITEM), 'the open item of the menu is printed');
    // The fixture gate names no repository (ledgerId none): since 503fad170 a choice whose kernel step cannot bind its repository is not offered.
    assert.match(text, /choices: record-defect --text <cause> \| none-fits --text <reason>/, 'its options are printed');
    assert.doesNotMatch(text, /not-runtime-fault|workaround/, 'a choice that cannot bind is not offered');
    assert.match(text, /starci supervisor actions record --item runtime-defect:<cause>/, 'the defect record is spelled');
  });
}

test('the reads, the decision verb, the defect record and the collectors it owns pass', () => {
  const allowed = [['supervisor', 'status', '--json'], ['supervisor', 'status', '--menu'], ['supervisor', 'decide', '--item', GATE_ITEM, '--choice', 'not-runtime-fault', '--reason', 'r'],
    ['supervisor', 'poll', '--once'], ['supervisor', 'actions', 'list', '--open'], ['supervisor', 'actions', 'digest'],
    ['supervisor', 'actions', 'record', '--item', 'runtime-defect:push-hook', '--action', 'recorded', '--reason', 'r'],
    ['supervisor', 'actions', 'record', '--item=runtime-defect:x', '--action', 'recorded', '--reason', 'r'],
    ['supervisor', 'channel', 'inbox', '--id', 'main'], ['supervisor', 'channel', 'reply', '--id', 'main', '--to', '1', '--text', 'ok'], ['supervisor', 'workers', 'list'],
    ['supervisor', 'gc', '--dry-run'], ['machine', 'decisions', 'supervisor', '--list'], ['kernel', 'status', '--repo', 'r', '--workflow', 'wf-seat'],
    ['kernel', 'decisions', '--workflow', 'wf-seat'], ['kernel', 'inbox', '--workflow', 'wf-seat'], ['workflow', 'status']];
  for (const args of allowed) assert.equal(starci(...args), null, args.join(' '));
  assert.equal(verdict('cat', ['supervise.yaml']), null);
  assert.equal(verdict('rg', ['gate', 'modules']), null);
});

test('the Supervisor still reaches the Orca protocol of its own seat', () => {
  const heartbeat = ['orchestration', 'send', '--from', 'term-sup', '--type', 'heartbeat', '--subject', 'alive'];
  assert.equal(policyVerdict({ role: 'supervisor', command: { program: 'orca', args: heartbeat, cwd: ROOT }, handle: 'term-sup', policy: POLICY }), null);
});

test('with nothing waiting the refusal says so and still spells the decision verb', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-seat-empty-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, [TEST_REGISTRY_ENV]: path.join(dir, 'machine.sqlite') };
  const refused = supervisorSeatVerdict({ policy: POLICY, program: 'starci', args: ['supervisor', 'workers', 'spawn'], text: 'starci supervisor workers spawn', env });
  assert.match(refused.use, /nothing waits on the Supervisor/);
  assert.match(refused.use, /starci supervisor decide --item <id> --choice <choice>/);
});
