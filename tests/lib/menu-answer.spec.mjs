// The answer core the Kernel's and the Supervisor's `decide` share (scripts/lib/menu-answer.mjs): each refusal code, the lookup, the demanded text and the stop at the first failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { answerMenuItem, answerOf, incompleteAnswer, missingText, pickOption, runUntilFailure, stepsFailed, validateAnswer } from '../../scripts/lib/menu-answer.mjs';

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

const answeredMenu = (option = {}) => [{ id: 'item', options: [{ choice: 'act', steps: ['first', 'second', 'third'], effect: 'proceed', ...option }] }];
const answer = { item: 'item', choice: 'act', reason: '  evidence  ', text: '' };
const seatOf = (seen, { fail = false, ownerOk = true, closeEscape = false } = {}) => ({
  record: () => { seen.push('record'); return 'decision'; },
  execute: () => runUntilFailure(['first', 'second', 'third'], (step) => { seen.push(step); return { ok: !(fail && step === 'second'), step }; }),
  escalate: ({ text }) => { seen.push(`escalate:${text}`); return { ok: ownerOk }; },
  closeEscape,
  resolve: () => { seen.push('resolve'); return true; },
  finish: () => { seen.push('finish'); },
});

test('validation shares direct and optional-text policy and trims the caller input', () => {
  assert.equal(validateAnswer(answeredMenu({ direct: true }), answer, { menuName: 'menu' }).refusal.code, 'menu-direct-option');
  assert.equal(validateAnswer(answeredMenu({ text: 'note' }), answer, { menuName: 'menu' }).refusal.code, 'menu-text-missing');
  const picked = validateAnswer(answeredMenu({ text: 'note', optionalText: true }), answer, { menuName: 'menu' });
  assert.equal(picked.reason, 'evidence');
  assert.equal(picked.text, '');
});

test('a refused answer records and executes nothing', async () => {
  const seen = [];
  const result = await answerMenuItem({ menu: answeredMenu(), answer: { ...answer, choice: 'unknown' }, menuName: 'menu' }, seatOf(seen));
  assert.equal(result.refusal.code, 'menu-choice-unknown');
  assert.deepEqual(seen, []);
});

test('a successful answer records before execution and resolves before finishing', async () => {
  const seen = [];
  const result = await answerMenuItem({ menu: answeredMenu(), answer, menuName: 'menu' }, seatOf(seen));
  assert.deepEqual(seen, ['record', 'first', 'second', 'third', 'resolve', 'finish']);
  assert.equal(result.recorded, 'decision');
  assert.equal(answerOf(result).ok, true);
  assert.equal(result.closed, true);
});

test('the first failed step stops execution and leaves the decision open', async () => {
  const seen = [];
  const result = await answerMenuItem({ menu: answeredMenu(), answer, menuName: 'menu' }, seatOf(seen, { fail: true }));
  assert.deepEqual(seen, ['record', 'first', 'second', 'finish']);
  assert.equal(result.closed, null);
  assert.equal(answerOf(result).ok, false);
});

test('snooze and keepsOpen choices execute while preserving the open item', async () => {
  for (const option of [{ snooze: true }, { keepsOpen: true }]) {
    const seen = [];
    const result = await answerMenuItem({ menu: answeredMenu(option), answer, menuName: 'menu' }, seatOf(seen));
    assert.equal(result.closed, null);
    assert.deepEqual(seen, ['record', 'first', 'second', 'third', 'finish']);
  }
});

test('escape skips steps and closes only after a successful owner handoff when the seat permits it', async () => {
  for (const options of [{ closeEscape: false }, { closeEscape: true, ownerOk: false }, { closeEscape: true, ownerOk: true }]) {
    const seen = [];
    const result = await answerMenuItem({ menu: answeredMenu({ escape: true }), answer, menuName: 'menu' }, seatOf(seen, options));
    const closed = options.closeEscape && options.ownerOk;
    assert.equal(result.closed, closed ? true : null);
    assert.deepEqual(seen, closed ? ['record', 'escalate:evidence', 'resolve', 'finish'] : ['record', 'escalate:evidence', 'finish']);
    assert.deepEqual(result.done, []);
  }
});
