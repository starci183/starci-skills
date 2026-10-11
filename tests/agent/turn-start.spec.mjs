// A worker-start whose turn start Orca could not observe (outcome_unknown / turn_start_unobserved) is classified from the receipt, and the frame decides what the runtime does:
// an unsubmitted paste chip in the input box is a known state and gets one Enter from the runtime; a turn already running stands; anything else is refused by the caller.
// The sequence on a live host (Codex 0.160, Nivo Kernel 2026-10-09) is tests/replay/codex-turn-start.spec.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resubmitUnobservedTurn, turnStartUnobserved } from '../../scripts/agent/turn-start.mjs';

const CHIP = ['>_ OpenAI Codex (v0.160.0)', '', '› [Pasted Content 16831 chars]', '  GPT-6.1-Sol high fast'].join('\n');
const IDLE = ['>_ OpenAI Codex (v0.160.0)', '', '› Ask Codex to do anything', '  GPT-6.1-Sol high fast'].join('\n');
const RUNNING = ['>_ OpenAI Codex (v0.160.0)', '', '• Working (3s • esc to interrupt)', '› '].join('\n');

/** A scripted terminal: reads answer `frames` in order (the last one repeats); `sends` records every send. */
const scripted = (frames, { read = true } = {}) => {
  const log = { sends: [], reads: 0 };
  return { log, io: {
    read: () => { const frame = frames[Math.min(log.reads, frames.length - 1)]; log.reads += 1; return read ? { ok: true, screen: frame } : { ok: false }; },
    send: (call) => { log.sends.push(call); return { ok: true }; },
    sleep: () => {},
  } };
};

test('the receipt is classified by its stage wherever the host put it', () => {
  assert.equal(turnStartUnobserved({ result: { stage: 'turn_start_unobserved', state: 'outcome_unknown' } }), true);
  assert.equal(turnStartUnobserved({ errorReceipt: { stage: 'turn_start_unobserved' } }), true);
  assert.equal(turnStartUnobserved({ error: 'worker-start failed: turn_start_unobserved' }), true);
  assert.equal(turnStartUnobserved({ result: { stage: 'agent_readiness' }, error: 'agent did not reach readiness' }), false);
  assert.equal(turnStartUnobserved(null), false);
});





test('a turn that already runs stands without any input; an idle empty box and an unreadable frame are not repaired by typing', () => {
  const running = scripted([RUNNING]);
  assert.equal(resubmitUnobservedTurn({ terminal: 'term_x', io: running.io }).state, 'submitted');
  assert.equal(running.log.sends.length, 0);
  const idle = scripted([IDLE]);
  assert.equal(resubmitUnobservedTurn({ terminal: 'term_x', io: idle.io }).state, 'unsubmitted');
  assert.equal(idle.log.sends.length, 0, 'the runtime types only into a frame it knows');
  const blind = scripted([CHIP], { read: false });
  assert.equal(resubmitUnobservedTurn({ terminal: 'term_x', io: blind.io }).state, 'unreadable');
  assert.equal(blind.log.sends.length, 0);
});
