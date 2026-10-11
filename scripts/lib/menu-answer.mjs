// menu-answer.mjs — what the Kernel's `decide` and the Supervisor's `decide` share when a seat answers one item of its menu: the refusal codes and their
// sentences, validation, recording, execution, resolution and response. Each seat supplies its menu, executor, recorder and escalation target.

import { findInOrder } from './in-order.mjs';

/** The refusal of an answer that names no choice or no reason, else null. */
export const incompleteAnswer = ({ choice, reason }) => (choice && reason ? null
  : { code: 'decide-answer-incomplete', error: 'decide needs --item <id>, --choice <choice> and --reason <why>' });

/** `{item, option}` for the item and choice an answer names in `menu`, else `{refusal}`; `menuName` finishes "is not an open item of ...". */
export function pickOption(menu, { itemId, choice, menuName }) {
  const item = menu.find((entry) => entry.id === itemId);
  if (!item) return { refusal: { code: 'menu-item-unknown', error: `${itemId ?? '(none)'} is not an open item of ${menuName}` } };
  const option = item.options.find((entry) => entry.choice === choice);
  if (!option) return { refusal: { code: 'menu-choice-unknown', error: `${choice} is not a choice of ${item.id} (${item.options.map((entry) => entry.choice).join(', ')})` } };
  return { item, option };
}

/** The refusal of an option that demands a text the caller did not give (an escape takes the reason as its text), else null. */
export const missingText = (item, option, text, { demanded = true } = {}) => (option.text && !option.escape && !text && demanded
  ? { code: 'menu-text-missing', error: `${item.id} ${option.choice} needs --text <${option.text}>` } : null);

/** Validates one answer against the current menu; escape uses the reason as text. `demandsText` describes the seat's step argument form. */
export function validateAnswer(menu, answer, { menuName, demandsText = () => true }) {
  const reason = String(answer.reason ?? '').trim();
  const incomplete = incompleteAnswer({ choice: answer.choice, reason });
  if (incomplete) return { refusal: incomplete };
  const picked = pickOption(menu, { itemId: answer.item, choice: answer.choice, menuName });
  if (picked.refusal) return picked;
  const { item, option } = picked;
  if (option.direct) return { refusal: { code: 'menu-direct-option', error: `${option.choice} of ${item.id} is run directly: ${option.effect}` } };
  const text = option.escape ? reason : String(answer.text ?? '').trim();
  const lacking = missingText(item, option, text, { demanded: !option.optionalText && demandsText(option) });
  return lacking ? { refusal: lacking } : { item, option, reason, text };
}

/** Records a valid answer, runs its steps or escalation, resolves eligible items and finishes the record; failed steps never resolve an item. */
export async function answerMenuItem({ menu, answer, menuName }, seat) {
  const picked = validateAnswer(menu, answer, { menuName, demandsText: seat.demandsText });
  if (picked.refusal) return picked;
  const recorded = await seat.record(picked);
  const done = picked.option.escape ? [] : await seat.execute({ ...picked, recorded });
  const failed = stepsFailed(done);
  const escalation = picked.option.escape ? await seat.escalate(picked) : null;
  const closeable = !failed && !picked.option.keepsOpen && !picked.option.snooze && (!picked.option.escape || (seat.closeEscape && escalation?.ok));
  const closed = closeable ? await seat.resolve({ ...picked, recorded, done }) : null;
  const result = { ...picked, recorded, done, failed, escalation, closed };
  if (seat.finish) await seat.finish(result);
  return result;
}

/** The common response fields; seats add their record identity, resolution and typed step failure. */
export const answerOf = ({ item, option, done }, extra = {}) => ({ ok: !stepsFailed(done), item: item.id, choice: option.choice, effect: option.effect, steps: done, ...extra });

/** Runs `steps` in order through `run(step)` -> {ok, ...} and stops after the first failure: the list of results. */
export async function runUntilFailure(steps, run) {
  const done = [];
  await findInOrder(steps, async (step) => {
    const result = await run(step);
    done.push(result);
    return !result.ok;
  });
  return done;
}

/** The first failed result of `runUntilFailure`, or null. */
export const stepsFailed = (done) => done.find((entry) => !entry.ok) ?? null;
