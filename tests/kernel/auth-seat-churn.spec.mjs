// auth-seat-churn (wf-nivo-auth-mum8xr9a, DI di-5827b9ee, SEAT_QUARANTINED sdi-70ade9d2): on 2026-09-29 the
// watchdog's H11 idle-replace closed the nivo-auth Kernel 5 times while it was writing its own records behind an ask
// it could not serve, and a replace whose tab close timed out was counted as a restart, which quarantined the seat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { idleWakesOf, replaceIdleKernel, replaceWakeDeadKernel, startAnswerOf, WAKE_IDLE_WINDOW_MS } from '../../scripts/kernel/kernel-watchdog.mjs';
import { REPLACED, seatStateOf } from '../../scripts/reconciler/controllers/host.mjs';

const at = (hhmmss) => Date.parse(`2026-09-29T${hhmmss}Z`);
const rows = (...pairs) => pairs.map(([kind, t]) => ({ kind, created_at: at(t) }));

test('A1: a Kernel that writes its own records between wakes is not idle (the 10:39-10:44 rows)', () => {
  const idle = idleWakesOf(rows(['kernel-woken', '10:30:00'], ['kernel-decision', '10:41:10'], ['kernel-woken', '10:42:00'], ['kernel-woken', '10:43:30']),
    { now: at('10:44:40') });
  assert.equal(idle.wakes, 2);
  assert.equal(idle.due, false);
  for (const kind of ['kernel-decision-result', 'kernel-proposal', 'autopilot-deferred-to-handover', 'ask-superseded', 'ask-answered', 'peer-message-acked', 'runtime-rev-acked']) {
    const other = idleWakesOf(rows(['kernel-woken', '10:00:00'], ['kernel-woken', '10:05:00'], [kind, '10:06:00'], ['kernel-woken', '10:20:00']), { now: at('10:40:00') });
    assert.equal(other.wakes, 1, kind);
    assert.equal(other.due, false, kind);
  }
});

test('A1b: the wakes an earlier Kernel incarnation received do not count against the one that booted after them', () => {
  for (const boot of ['kernel-booted', 'kernel-restarted']) {
    const idle = idleWakesOf(rows(['kernel-woken', '10:00:00'], ['kernel-woken', '10:01:00'], ['kernel-woken', '10:02:00'], [boot, '10:05:00'], ['kernel-woken', '10:06:00']), { now: at('10:30:00') });
    assert.equal(idle.wakes, 1, boot);
    assert.equal(idle.firstWakeAt, at('10:06:00'), boot);
  }
  const kept = idleWakesOf(rows(['kernel-replaced-idle', '10:03:00'], ['kernel-restarted', '10:05:00'], ['kernel-woken', '10:06:00']), { now: at('10:30:00') });
  assert.equal(kept.replaced, 1, 'a boot does not clear the idle-replacement streak the escalation reads');
});

test('A2: three wakes piled up within 90 s are not a replace; the same wakes spanning the window are', () => {
  const wakes = rows(['kernel-woken', '10:05:27'], ['kernel-woken', '10:06:23'], ['kernel-woken', '10:06:53']);
  const early = idleWakesOf(wakes, { now: at('10:07:52') });
  assert.equal(early.wakes, 3);
  assert.equal(early.firstWakeAt, at('10:05:27'));
  assert.equal(early.due, false);
  assert.equal(idleWakesOf(wakes, { now: at('10:05:27') + WAKE_IDLE_WINDOW_MS }).due, true);
});

test('A3: a settle-tail op-settled between streaks does not reset the replace streak: the next idle streak escalates', () => {
  const idle = idleWakesOf(rows(['kernel-replaced-idle', '10:07:52'], ['op-settled', '10:08:45'], ['op-dispatched', '10:09:00'],
    ['kernel-woken', '10:10:00'], ['kernel-woken', '10:15:00'], ['kernel-woken', '10:21:00']), { now: at('10:22:08') });
  assert.equal(idle.due, true);
  assert.equal(idle.replaced, 1, 'escalate, not replace');
  // a Kernel's own record resets the wakes but keeps the streak
  const held = idleWakesOf(rows(['kernel-replaced-idle', '10:07:52'], ['kernel-decision', '10:09:07'],
    ['kernel-woken', '10:10:00'], ['kernel-woken', '10:15:00'], ['kernel-woken', '10:21:00']), { now: at('10:22:08') });
  assert.equal(held.replaced, 1);
  // a Kernel-authored job move clears it; a replace older than the hour window does not count
  assert.equal(idleWakesOf(rows(['kernel-replaced-idle', '10:07:52'], ['job-enqueued', '10:09:00'], ['kernel-woken', '10:10:00']), { now: at('10:22:08') }).replaced, 0);
  assert.equal(idleWakesOf(rows(['kernel-replaced-idle', '08:52:00'], ['kernel-woken', '10:10:00']), { now: at('10:22:08') }).replaced, 0);
});

test('B: a start answer that replaced nothing is not counted as a restart', () => {
  const answer = startAnswerOf({ ok: true, value: { ok: true, workflowId: 'wf-nivo-auth-mum8xr9a', kernel: 'k', terminal: 'term_4212466f', replaced: false, note: 'terminal connected' } },
    { terminal: 'term_4212466f' });
  assert.equal(answer.action, 'already-live');
  assert.equal(REPLACED.has(answer.action), false);
  assert.equal(seatStateOf(answer.action), 'live');
  assert.equal(startAnswerOf({ ok: true, value: { ok: true, terminal: 'term_new' } }).action, 'restarted');
  assert.equal(startAnswerOf({ ok: false, value: null, stderr: 'boom' }).action, 'restart-failed');
});

test('B2: an idle replacement no restart could launch leaves the live seat in place', () => {
  const calls = [];
  const kept = replaceIdleKernel({ phase: 'running', terminal: 'term-k', stale: {}, outputAgeMs: 120_000, idle: { wakes: 3 } }, {
    launchableSender: () => ({ ok: false, reason: 'workflow-sender-terminal-missing', error: 'no_active_sender_terminal' }),
    closeKernelTerminal: () => { calls.push('close'); return { ok: true }; },
    withKernelLedger: () => { calls.push('event'); },
    replaceKernel: () => { calls.push('replace'); return { ok: true }; },
  });
  assert.equal(kept.action, 'replacement-unlaunchable');
  assert.equal(kept.reason, 'workflow-sender-terminal-missing');
  assert.deepEqual(calls, [], 'the seat is not closed, no replaced-idle event, no start');
  assert.equal(REPLACED.has(kept.action), false);
  assert.equal(seatStateOf(kept.action), 'live');
});

test('B: an idle or wake-dead replace whose terminal close failed answers kernel-terminal-close-failed before start-workflow', () => {
  for (const [name, fn, input] of [
    ['replaceIdleKernel', replaceIdleKernel, { idle: { wakes: 3 } }],
    ['replaceWakeDeadKernel', replaceWakeDeadKernel, { misses: 3, firstAt: at('10:00:00') }],
  ]) {
    const calls = [];
    const result = fn({ phase: 'running', terminal: 'term-k', stale: {}, outputAgeMs: 120_000, ...input }, {
      launchableSender: () => ({ ok: true }),
      closeKernelTerminal: () => { calls.push('close'); return { ok: false, error: 'tab close timed out' }; },
      replaceKernel: () => { calls.push('replace'); return { ok: true }; },
      withKernelLedger: () => { calls.push('event'); },
    });
    assert.equal(result.action, 'kernel-terminal-close-failed', name);
    assert.deepEqual(calls, ['close'], `${name} never starts a replacement or records success after a refused close`);
  }
  const calls = [];
  const replaced = replaceIdleKernel({ phase: 'running', terminal: 'term-k', stale: {}, outputAgeMs: 120_000, idle: { wakes: 3 } }, {
    launchableSender: () => ({ ok: true }),
    closeKernelTerminal: () => { calls.push('close'); return { ok: true }; },
    withKernelLedger: (fn) => fn({ transaction: (work) => work(), appendEvent: ({ kind }) => calls.push(kind) }),
    replaceKernel: () => { calls.push('replace'); return { ok: true, action: 'restarted' }; },
  });
  assert.equal(replaced.action, 'restarted');
  assert.deepEqual(calls, ['close', 'kernel-replaced-idle', 'replace'], 'a successful idle replacement is recorded only after close proof');
  assert.equal(seatStateOf('kernel-terminal-close-failed'), 'replacing');
  assert.equal(REPLACED.has('kernel-terminal-close-failed'), false);
});

test('A1c: wakes given under an earlier runtime revision do not count against the Kernel after a deploy (StarCi 13:48: 3 wakes before the deploy replaced the Kernel 12 minutes after it)', () => {
  const withRev = (kind, t, rev) => ({ kind, created_at: at(t), payload_json: JSON.stringify({ rev }) });
  const wakes = [withRev('kernel-woken', '10:00:00', 'old'), withRev('kernel-woken', '10:01:00', 'old'), withRev('kernel-woken', '10:02:00', 'old')];
  assert.equal(idleWakesOf(wakes, { now: at('10:40:00'), rev: 'old' }).due, true, 'the same revision: three idle wakes replace the Kernel');
  const after = idleWakesOf(wakes, { now: at('10:40:00'), rev: 'new' });
  assert.equal(after.wakes, 0, 'a new revision starts the streak over');
  assert.equal(after.due, false);
  const mixed = idleWakesOf([...wakes, withRev('kernel-woken', '10:30:00', 'new')], { now: at('10:40:00'), rev: 'new' });
  assert.equal(mixed.wakes, 1, 'only the wake given under the live revision counts');
});
