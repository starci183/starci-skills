// menu-answer.mjs — what the Kernel's `decide` and the Supervisor's `decide` share when a seat answers one item of its menu: the refusal codes and their
// sentences, the lookup of the item and the choice, the text an option demands and the run-until-the-first-failure of an option's steps. Each seat keeps
// its own menu source, its own option fields (the Kernel's `direct`, `optionalText`, `snooze`), its own executor (in-process verb, child `starci`) and its
// own escalation target.

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
