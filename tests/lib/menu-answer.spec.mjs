// The answer core the Kernel's and the Supervisor's `decide` share (scripts/lib/menu-answer.mjs): each refusal code, the lookup, the demanded text and the stop at the first failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { incompleteAnswer, missingText, pickOption, runUntilFailure, stepsFailed } from '../../scripts/lib/menu-answer.mjs';

const menu = [{ id: 'job-1', options: [{ choice: 'retry', text: 'note' }, { choice: 'none-fits', text: 'reason', escape: true }, { choice: 'wait' }] }];

test('an answer without a choice or a reason is incomplete', () => {
  assert.equal(incompleteAnswer({ choice: 'retry', reason: 'because' }), null);
  assert.equal(incompleteAnswer({ choice: 'retry', reason: '' }).code, 'decide-answer-incomplete');
  assert.equal(incompleteAnswer({ choice: null, reason: 'because' }).code, 'decide-answer-incomplete');
});

test('the item and the choice are looked up in the menu, each unknown one refused with its code', () => {
  const found = pickOption(menu, { itemId: 'job-1', choice: 'wait', menuName: 'the menu' });
  assert.equal(found.item.id, 'job-1');
  assert.equal(found.option.choice, 'wait');
  const noItem = pickOption(menu, { itemId: 'job-9', choice: 'wait', menuName: "wf-1's menu" });
  assert.deepEqual([noItem.refusal.code, noItem.refusal.error], ['menu-item-unknown', "job-9 is not an open item of wf-1's menu"]);
  const noChoice = pickOption(menu, { itemId: 'job-1', choice: 'dance', menuName: 'the menu' });
  assert.equal(noChoice.refusal.code, 'menu-choice-unknown');
  assert.match(noChoice.refusal.error, /retry, none-fits, wait/);
});

test('an option that declares a text demands it, except an escape (the reason is its text) or when the seat says the steps do not use it', () => {
  const [item] = menu;
  assert.equal(missingText(item, item.options[0], '').code, 'menu-text-missing');
  assert.equal(missingText(item, item.options[0], 'x'), null);
  assert.equal(missingText(item, item.options[1], ''), null);
  assert.equal(missingText(item, item.options[2], ''), null);
  assert.equal(missingText(item, item.options[0], '', { demanded: false }), null);
});

test('steps run in order and stop after the first failure', async () => {
  const seen = [];
  const done = await runUntilFailure(['a', 'b', 'c'], async (step) => { seen.push(step); return { step, ok: step !== 'b' }; });
  assert.deepEqual(seen, ['a', 'b']);
  assert.deepEqual(stepsFailed(done), { step: 'b', ok: false });
  assert.equal(stepsFailed([{ ok: true }]), null);
});
