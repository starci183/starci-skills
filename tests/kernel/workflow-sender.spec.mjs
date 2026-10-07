import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { headlessSenderOf, workflowSender } from '../../scripts/kernel/workflow-startup.mjs';

// The audited machine: the Host controller restarts a dead Kernel with no ORCA_TERMINAL_HANDLE and every attempt answered
// no_active_sender_terminal (50+ times). An unattended watchdog launch takes a runtime-owned terminal as its sender; an
// owner or Supervisor start without a terminal is still refused, and so is a watchdog launch with nothing to send from.
const ROOT = path.resolve('/runtime/clone');
const term = (handle, extra = {}) => ({ handle, connected: true, writable: true, worktreePath: ROOT, ...extra });
const listing = (...terminals) => ({ ok: true, terminals });
const deps = (terminals, { coordinator = null, seats = [], recorded = [] } = {}) => ({
  list: () => (terminals ? listing(...terminals) : { ok: false, error: 'host-unavailable' }),
  show: () => ({ ok: true, coordinator }),
  machine: () => ({ recorded: new Set(recorded), seats: new Set(seats) }),
});
const watchdog = { env: {}, launchedBy: 'watchdog', ledger: null, workflowId: 'wf-a', root: ROOT };

test('the caller terminal is the sender whoever launched; no terminal refuses owner and Supervisor starts', () => {
  assert.deepEqual(workflowSender({ ...watchdog, env: { ORCA_TERMINAL_HANDLE: 'term_caller' } }, deps([])), { ok: true, handle: 'term_caller', source: 'caller' });
  for (const launchedBy of ['supervisor', 'owner']) {
    const out = workflowSender({ ...watchdog, launchedBy }, deps([term('term_plain')]));
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'workflow-sender-terminal-missing');
  }
});

test('a headless watchdog launch sends from a plain terminal of the runtime worktree, preferring the Run coordinator', () => {
  const terminals = [term('term_foreign', { worktreePath: path.resolve('/elsewhere') }), term('term_agent', { agentIdentity: 'claude' }), term('term_a'), term('term_b')];
  assert.deepEqual(headlessSenderOf({ listing: listing(...terminals), root: ROOT }), { ok: true, handle: 'term_a', source: 'runtime-worktree' });
  assert.equal(headlessSenderOf({ listing: listing(...terminals), coordinator: 'term_b', root: ROOT }).handle, 'term_b');
  assert.equal(headlessSenderOf({ listing: listing(...terminals), recorded: new Set(['term_a', 'term_b']), root: ROOT }).ok, false);
});

test('without a runtime worktree terminal the live Supervisor seat sends; a dead or absent one refuses with the typed code', () => {
  const seat = term('term_sup', { worktreePath: path.resolve('/sup') });
  const out = headlessSenderOf({ listing: listing(seat), seats: new Set(['term_sup']), root: ROOT });
  assert.deepEqual(out, { ok: true, handle: 'term_sup', source: 'supervisor-seat' });
  const dead = headlessSenderOf({ listing: listing({ ...seat, connected: false }), seats: new Set(['term_sup']), root: ROOT });
  assert.equal(dead.ok, false);
  assert.equal(dead.reason, 'workflow-sender-terminal-missing');
  assert.match(dead.error, /^no_active_sender_terminal/);
});

test('an unavailable terminal listing refuses the headless launch rather than guessing', () => {
  const out = workflowSender(watchdog, deps(null));
  assert.equal(out.ok, false);
  assert.match(out.error, /terminal listing is unavailable/);
});
