import test from 'node:test';
import assert from 'node:assert/strict';
import { quitAgent, QUIT_COMMAND } from '../scripts/kernel/quit-agent.mjs';

// Three Mia Mia architecture.decide Claude workers settled while their
// processes kept running hidden; the reaper refused to guess among three
// candidates started together. A settled agent now quits itself first.
test('the agent quit command is typed and the terminal is watched until it disconnects', () => {
  let connected = true; const sent = [];
  const show = () => ({ ok: true, connected });
  const send = ({ text, enter }) => { sent.push([text, enter]); connected = false; return { ok: true }; };
  const r = quitAgent({ handle: 'term-1', agent: 'claude', show, send, sleep: () => {} });
  assert.deepEqual(r, { sent: true, exited: true, command: '\u0003\u0003' });
  assert.deepEqual(sent, [['\u0003\u0003', false]], 'Claude quits on a double Ctrl+C with no Enter; a pasted /exit is only chat text');
  assert.equal(QUIT_COMMAND.codex, '/quit');
});

test('no quit for an unknown agent or a terminal that is already gone; a busy agent reports not exited', () => {
  assert.equal(quitAgent({ handle: 'term-1', agent: 'devin', show: () => ({ ok: true, connected: true }), send: () => ({ ok: true }), sleep: () => {} }), null);
  assert.equal(quitAgent({ handle: 'term-1', agent: 'claude', show: () => ({ ok: true, connected: false }), send: () => { throw new Error('never sent'); }, sleep: () => {} }), null);
  const busy = quitAgent({ handle: 'term-1', agent: 'codex', waitMs: 1000, intervalMs: 500,
    show: () => ({ ok: true, connected: true }), send: () => ({ ok: false, errorCode: 'agent_prompt_stalled' }), sleep: () => {} });
  assert.deepEqual(busy, { sent: true, exited: false, command: '/quit' }, 'a queued quit counts as sent; the close still follows');
});
