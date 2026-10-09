// The Kernel watchdog tick and a revision change: a concerned Kernel with an empty menu is woken once; a Kernel whose rule was removed is
// replaced at its next yield with the distinct reason contract-changed; a Kernel the change does not concern is left alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKernelTick } from '../../scripts/kernel/kernel-watchdog-tick.mjs';
import { wakePromptOf } from '../../scripts/kernel/kernel-watchdog.mjs';

const WF = 'wf-tick';
const notice = (state, extra = {}) => ({ role: 'kernel', state, from: 'a'.repeat(40), to: 'b'.repeat(40), action: 'reread', count: 1, files: ['modules/kernel/driver-loop.yaml'], replaceFiles: [], ...extra });

function tickWith({ frontier = { actionable: false, reason: 'nothing waits' }, revisionNotice = null, rotationDue = false } = {}) {
  const log = { sent: [], revisionWoken: [], rotated: [] };
  const deps = {
    workflowId: WF, repair: true,
    api: () => ({ ok: true, value: { ok: true, signals: [{ scope: 'kernel', key: WF, value: { terminal: 'T1', dispatch: 'D1' } }] } }),
    lostSeatWorker: () => null, exitedTwice: () => false, stopAndRelease: () => ({ ok: true }), replaceKernel: () => ({ action: 'restarted' }),
    workerShow: () => ({ ok: true, state: 'running' }), DEAD_WORKER_STATE: /dead/, settledKernelVerdict: () => ({ verdict: 'live', shown: { terminal: {} } }), DEAD_VERDICTS: new Set(),
    terminalRead: () => ({ ok: true, screen: 'idle' }), classifyKernelScreen: () => ({ state: 'turn-idle' }), outputAgeOf: () => ({ lastOutputAt: null, outputAgeMs: 0 }),
    staleAwareState: (state) => ({ state, staleActive: false }), ACTIVE_STALE_MS: 1, exitedAgentPromptRow: () => null, DEATH_SETTLE_MS: 0, sleepSync: () => {},
    kernelWakeFailures: () => [], wakeFailuresProveDead: () => ({ dead: false }), kernelIdleWakes: () => ({ wakes: 0, replaced: 0, due: false }),
    kernelRotation: { due: () => ({ due: rotationDue, reason: rotationDue ? '8 wakes since its boot' : null }), rotate: (args) => { log.rotated.push(args.rotation.reason); return { ok: true, action: 'rotated' }; } },
    sendWakeWithProof: (args) => { log.sent.push(args.text); return { ok: true, delivery: 'typed' }; }, wakePromptOf: (wf, value) => `wake ${value.revisionNotice?.state ?? 'none'}`,
    recordKernelWoken: () => {}, recordKernelWakeFailed: () => {}, wakeSendRefused: () => false, wakeActionOf: (proof) => (proof.ok ? 'woken' : 'wake-failed'),
    deliveryFieldsOf: () => ({}), finalKernelAction: () => 'observed', jsonFromStdout: (v) => v, recordRevisionWoken: (n) => log.revisionWoken.push(n.to),
  };
  const status = { value: { frontier, revisionNotice, kernel: { attempt: 1 } } };
  return { result: createKernelTick(deps)(status, 'running'), log };
}

test('a concerned Kernel with an empty menu is woken once, with the notice in the wake', () => {
  const { result, log } = tickWith({ revisionNotice: notice('owed') });
  assert.equal(result.action, 'woken');
  assert.deepEqual(log.sent, ['wake owed']);
  assert.deepEqual(log.revisionWoken, ['b'.repeat(40)], 'the one wake of this revision is recorded');
});

test('after that wake the empty menu is quiet again: no second wake for the same revision', () => {
  const { result, log } = tickWith({ revisionNotice: notice('owed-woken') });
  assert.equal(result.action, 'idle-waiting');
  assert.deepEqual(log.sent, []);
});

test('a Kernel the change does not concern, or has settled, is not woken with an empty menu', () => {
  for (const state of ['current', 'not-concerned', 'acked-legacy']) {
    const { result, log } = tickWith({ revisionNotice: notice(state) });
    assert.equal(result.action, 'idle-waiting', state);
    assert.deepEqual(log.sent, []);
  }
});

test('a Kernel whose contract lost a rule is replaced at its next yield with the reason contract-changed, and is not woken', () => {
  const { result, log } = tickWith({ revisionNotice: notice('replace-due', { action: 'replace', replaceFiles: ['modules/kernel/driver-loop.yaml'] }) });
  assert.equal(result.action, 'rotated');
  assert.equal(log.rotated.length, 1);
  assert.match(log.rotated[0], /^contract-changed: 1 rule file\(s\)/);
  assert.deepEqual(log.sent, []);
});

test('a Kernel already due for rotation by wakes is replaced by that rotation: the revision change folds into it', () => {
  const { result, log } = tickWith({ revisionNotice: notice('replace-due', { action: 'replace', replaceFiles: ['x'] }), rotationDue: true });
  assert.equal(result.action, 'rotated');
  assert.deepEqual(log.rotated, ['8 wakes since its boot'], 'one replacement, with the rotation reason, never an update and then a replacement');
});

test('the wake text carries the notice line and stays inside the wake bound', () => {
  const text = wakePromptOf(WF, { kernel: { attempt: 2 }, revisionNotice: notice('owed', { files: ['modules/kernel/driver-loop.yaml', 'modules/kernel/api.yaml', 'modules/kernel/owner-rulings.yaml', 'a', 'b'] }) });
  assert.match(text, /Runtime rev bbbbbbbbbbbb changed 5 file\(s\) of your contract \(modules\/kernel\/driver-loop\.yaml, modules\/kernel\/api\.yaml, modules\/kernel\/owner-rulings\.yaml and 2 more\)/);
  assert.match(text, /starci kernel revision-ack --workflow wf-tick --plan/);
  assert.ok(text.length <= 800, `${text.length} characters`);
});
