import test from 'node:test';
import assert from 'node:assert/strict';
import { wakeKernel, wakeKernelForTransition, transitionWakeText, WAKE_BOUNDS } from '../scripts/kernel/wake-delivery.mjs';
import { wakeAskAnswered } from '../scripts/kernel/serve-ask.mjs';
import * as stall from '../scripts/supervisor/stall-alert.mjs';

// One Kernel wake path (scripts/kernel/wake-delivery.mjs wakeKernel) serves the transition wakes (api.mjs),
// the ask-answered wake (serve-ask.mjs) and the stall and supervisor wakes (supervisor/stall-alert.mjs).
// The ask-answered copy once classified the frame without the stale-active rule: a Kernel whose frame
// froze on a spinner read turn-idle for every api wake but `active` for the owner's answer, and that
// wake was never delivered.
const CHROME = ['─────', '❯', '─────', '  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
const IDLE = [' Yielding — waiting on the peer.', '✻ Brewed for 3m 2s', ...CHROME].join('\n');
const ACTIVE = [' Reading status', '✻ Brewing… (12s · ↓ 1.2k tokens · esc to interrupt)', ...CHROME].join('\n');
const HOUR = 60 * 60_000;

const kernelLedger = (terminal = 'term_k') => {
  const events = [];
  return { events, db: { prepare: () => ({ get: () => (terminal ? { value_json: JSON.stringify({ terminal }) } : undefined) }) },
    transaction: (fn) => fn(), appendEvent: (e) => events.push(e) };
};
// Orca stand-ins: `frames` are answered in order (the last repeats); a frame is a screen or {screen, draft}.
const orca = (frames, { outputAgeMs = 0 } = {}) => {
  const sends = [];
  let i = 0;
  return { sends, deps: {
    show: () => ({ ok: true, connected: true, writable: true, terminal: { lastOutputAt: Date.now() - outputAgeMs } }),
    read: () => { const f = frames[Math.min(i++, frames.length - 1)]; return typeof f === 'string' ? { ok: true, screen: f } : { ok: true, ...f }; },
    send: (a) => { sends.push(a); return { ok: true }; }, sleep: () => {} } };
};
const woken = (text) => [`> ${text.slice(0, 120)}`, '✻ Brewing… (1s · esc to interrupt)', ...CHROME].join('\n');

test('the ask-answered wake reaches a Kernel whose active frame froze past activeStaleMs', () => {
  const ledger = kernelLedger();
  const text = transitionWakeText('wf-a', 'ask-answered', ['x']);
  const { deps, sends } = orca([ACTIVE, ACTIVE, woken('Durable transition wake for workflow wf-a: ask-answered. The owner answered the parked ask for dispatch ctx_1')],
    { outputAgeMs: 24 * HOUR });
  const r = wakeAskAnswered(ledger, { workflowId: 'wf-a', dispatchId: 'ctx_1', receiptPath: 'r.json', deps });
  assert.equal(r.action, 'kernel-woken', JSON.stringify(r));
  assert.equal(r.state, 'turn-idle', 'a frozen spinner is a yielded turn');
  assert.equal(sends.length, 1);
  assert.match(sends[0].text, /^Durable transition wake for workflow wf-a: ask-answered\. The owner answered the parked ask for dispatch ctx_1/);
  assert.ok(sends[0].text.endsWith(WAKE_BOUNDS));
  assert.ok(text.endsWith(WAKE_BOUNDS));
  assert.deepEqual(ledger.events.map((e) => [e.kind, e.payload.transition, e.payload.dispatchId, e.payload.priorState]),
    [['kernel-transition-woken', 'ask-answered', 'ctx_1', 'turn-idle']]);
});

test('a live spinner is kernel-busy for every wake path, and nothing is typed', () => {
  const ledger = kernelLedger();
  const { deps, sends } = orca([ACTIVE]);
  assert.equal(wakeAskAnswered(ledger, { workflowId: 'wf-a', dispatchId: 'ctx_1', receiptPath: 'r.json', deps }).action, 'kernel-busy');
  assert.equal(stall.wakeKernel({ db: ledger.db, workflowId: 'wf-a', text: '[stall] x', deps }).action, 'kernel-busy');
  assert.deepEqual([sends.length, ledger.events.length], [0, 0]);
});

test('pending input: a transition wake submits it with one Enter; a stall or supervisor wake leaves it to the Kernel watchdog', () => {
  const STAGED = { screen: IDLE, draft: '[Pasted Content 900 chars]' };
  const transition = orca([STAGED, STAGED, IDLE]);
  const r = wakeKernelForTransition(kernelLedger(), { workflowId: 'wf-a', transition: 'report-filed:done', lines: ['x'], deps: transition.deps });
  assert.equal(r.action, 'kernel-staged-input-sent', JSON.stringify(r));
  assert.deepEqual(transition.sends, [{ terminal: 'term_k', text: '', enter: true }]);
  const held = orca([STAGED]);
  assert.deepEqual([stall.wakeKernel({ db: kernelLedger().db, workflowId: 'wf-a', text: '[stall] x', deps: held.deps })].map((w) => [w.action, w.state]),
    [['kernel-busy', 'staged-input']]);
  assert.equal(held.sends.length, 0);
});

test('the stall and supervisor wakes use the same wake function', () => {
  assert.equal(stall.wakeKernel, wakeKernel);
  assert.equal(wakeKernel({ db: kernelLedger(null).db, workflowId: 'wf-a', text: 'x' }).action, 'kernel-signal-absent');
});
