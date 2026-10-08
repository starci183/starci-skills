import test from 'node:test';
import assert from 'node:assert/strict';
import { wakeKernelForTransition, transitionWakeText, wakeIdentity, withWakeIdentity } from '../../scripts/kernel/wake-delivery.mjs';
import { boundedWake, wakeMaxChars } from '../../scripts/kernel/wake-bound.mjs';
import { buildWakePrompt } from '../../scripts/kernel/kernel-watchdog.mjs';

// 2026-10-07, a real Kernel: twelve wakes of 1218 to 1242 characters reached it as <pasted_content> blocks (three refused), and all
// sixteen wakes of 730 characters or fewer reached it as the user's message. Claude Code folds a paste of about 800 characters.
const CLAUDE_CODE_PASTE_FOLD = 800;
const REV = 'Runtime rev c98cbc727 -> 1a5452b00 changed: 3 file(s); re-read them and ack before anything else.';
const LONG_LINES = ['Report filed for op-architecture.decide-e78adc94cc with 14 checks recorded: ' + 'x'.repeat(400), 'y'.repeat(300)];

test('the declared cap sits under the size Claude Code folds', () => {
  assert.ok(wakeMaxChars() < CLAUDE_CODE_PASTE_FOLD, `${wakeMaxChars()} characters`);
});

test('a wake of the audited 1218 characters is cut to its opener, the pointer and the seat identity', () => {
  const text = transitionWakeText('wf-starci-auth-test-workflow-muxq4oyr', 'report-filed:done', LONG_LINES);
  const unbounded = withWakeIdentity(text, 'wf-starci-auth-test-workflow-muxq4oyr', 12, REV);
  assert.ok(unbounded.length > CLAUDE_CODE_PASTE_FOLD, `the unbounded wake is ${unbounded.length} characters`);
  const bounded = boundedWake({ text, workflowId: 'wf-starci-auth-test-workflow-muxq4oyr', attempt: 12, revLine: REV, compose: withWakeIdentity });
  assert.ok(bounded.length <= wakeMaxChars(), `${bounded.length} characters`);
  assert.match(bounded, /^Durable transition wake for workflow wf-starci-auth-test-workflow-muxq4oyr: report-filed:done\. The rest is in starci kernel status\./);
  assert.ok(bounded.includes(REV), 'the runtime-rev sentence is kept while it fits');
  assert.ok(bounded.endsWith(wakeIdentity('wf-starci-auth-test-workflow-muxq4oyr', 12)), 'the seat identity always ends the wake');
});

test('a wake that already fits is typed unchanged', () => {
  const text = transitionWakeText('wf-a', 'ask-answered', ['x']);
  assert.equal(boundedWake({ text, workflowId: 'wf-a', attempt: 2, compose: withWakeIdentity }), withWakeIdentity(text, 'wf-a', 2, null));
});

test('a rev line too long to keep is dropped before the identity is', () => {
  const text = transitionWakeText('wf-a', 'ask-answered', LONG_LINES);
  const bounded = boundedWake({ text, workflowId: 'wf-a', attempt: 3, revLine: 'r'.repeat(600), compose: withWakeIdentity });
  assert.ok(bounded.length <= wakeMaxChars());
  assert.ok(!bounded.includes('rrrr'));
  assert.ok(bounded.endsWith(wakeIdentity('wf-a', 3)));
});

test('the watchdog wake with its rev line and identity stays under the cap', () => {
  assert.ok(buildWakePrompt('wf-starci-auth-test-workflow-muxq4oyr', 12, REV).length <= wakeMaxChars());
});

test('the one Kernel wake path types a long transition wake bounded', () => {
  const sends = [];
  const screen = [' Yielding.', '✻ Brewed for 3m 2s', '─────', '❯', '─────', '  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'].join('\n');
  const typed = (text) => [`> ${text.slice(0, 120)}`, '✻ Brewing… (1s · esc to interrupt)', '─────', '❯', '─────', '  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'].join('\n');
  let reads = 0;
  const deps = {
    show: () => ({ ok: true, connected: true, writable: true, terminal: { lastOutputAt: Date.now() } }),
    read: () => ({ ok: true, screen: reads++ < 2 ? screen : typed('Durable transition wake for workflow wf-a: report-filed:done. The rest is in starci kernel status.') }),
    send: (args) => { sends.push(args); return { ok: true }; }, sleep: () => {},
  };
  const ledger = { db: { prepare: () => ({ get: () => ({ value_json: JSON.stringify({ terminal: 'term_k' }) }) }) }, transaction: (fn) => fn(), appendEvent: () => {} };
  wakeKernelForTransition(ledger, { workflowId: 'wf-a', transition: 'report-filed:done', lines: LONG_LINES, deps });
  assert.equal(sends.length, 1);
  assert.ok(sends[0].text.length <= wakeMaxChars(), `${sends[0].text.length} characters typed`);
});
