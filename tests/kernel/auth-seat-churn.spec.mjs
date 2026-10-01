// auth-seat-churn (wf-nivo-auth-mum8xr9a, DI di-5827b9ee, SEAT_QUARANTINED sdi-70ade9d2): on 2026-09-29 the
// watchdog's H11 idle-replace closed the nivo-auth Kernel 5 times while it was writing its own records behind an ask
// it could not serve, and a replace whose tab close timed out was counted as a restart, which quarantined the seat.
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { idleWakesOf, startAnswerOf, WAKE_IDLE_WINDOW_MS } from '../../scripts/kernel/kernel-watchdog.mjs';
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

test('B: an idle or wake-dead replace whose terminal close failed answers kernel-terminal-close-failed before start-workflow', () => {
  const src = fs.readFileSync(new URL('../../scripts/kernel/kernel-watchdog.mjs', import.meta.url), 'utf8');
  for (const fn of ['replaceIdleKernel', 'replaceWakeDeadKernel']) {
    const body = src.slice(src.indexOf(`const ${fn} = `), src.indexOf('};', src.indexOf(`const ${fn} = `)));
    const guard = body.indexOf('if (!terminalClosed.ok) return closeFailed(');
    assert.ok(guard > 0, `${fn} honours terminalClosed.ok`);
    assert.ok(guard < body.indexOf('replaceKernel('), `${fn} checks the close before start-workflow`);
  }
  const idle = src.slice(src.indexOf('const replaceIdleKernel = '));
  assert.ok(idle.indexOf('closeFailed(') < idle.indexOf('KERNEL_IDLE_REPLACED_EVENT'), 'an idle replace is recorded only after its terminal closed');
  assert.equal(seatStateOf('kernel-terminal-close-failed'), 'replacing');
  assert.equal(REPLACED.has('kernel-terminal-close-failed'), false);
});
