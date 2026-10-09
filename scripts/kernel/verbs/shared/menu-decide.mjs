// menu-decide.mjs — `starci kernel decide --item <id> --choice <choice> --reason <why>`: one typed answer to one item of the menu.
// The answer is validated against the menu as the ledger shows it now, recorded in the Kernel's decision log, then executed: the
// option's steps run in this process through the same `run` the standalone verbs have (verb-inproc.mjs). A choice that is not on
// the menu is refused with a typed code and the menu. `none-fits` records the reason and escalates the item up the role chain.
import { closeEntry, openEntry } from '../../decision-log.mjs';
import { escalateDecision, openDecisionRow, resolveDecision } from '../../../machine/decisions.mjs';
import { findInOrder } from '../../../lib/in-order.mjs';
import { refuseVerb } from './verb-exit.mjs';
import { runVerbInProcess } from './verb-inproc.mjs';
import { itemFactsOf } from '../../kernel-menu.mjs';
import { menuLines } from './status-menu.mjs';

const TEXT = '$text';

/** The menu as the ledger shows it now: the status projection run in this process. */
async function currentMenu(ctx) {
  const answer = await runVerbInProcess(ctx, 'status', { workflow: ctx.args.workflow, repo: ctx.repo, json: true });
  ctx.internals.setStatusAsk(null);
  if (!answer.ok || !Array.isArray(answer.out?.menu)) throw Object.assign(new Error(`the menu could not be read: ${answer.error ?? 'status emitted no menu'}`), { code: 'menu-unreadable' });
  return answer.out.menu;
}

/** A refusal that carries the current menu, so the caller answers again in one step. */
const refuseWithMenu = (ctx, menu, { code, error }) => refuseVerb(ctx, { ok: false, workflowId: ctx.args.workflow, code, error, menu },
  [`decide REFUSED (${code}): ${error}`, ...menuLines({ menu, workflowId: ctx.args.workflow })].join('\n'));

/** The steps of an option with the caller's --text bound to every `$text` argument; a missing optional text drops its flag. */
const bindArg = ([key, value], text) => {
  if (value !== TEXT) return [[key, value]];
  return text ? [[key, text]] : [];
};
const boundSteps = (option, text) => option.steps.map((step) => ({ verb: step.verb, args: Object.fromEntries(Object.entries(step.args ?? {}).flatMap((entry) => bindArg(entry, text))) }));

const flagText = ([key, value]) => (value === true ? `--${key}` : `--${key} ${String(value).slice(0, 60)}`);
const stepText = (step) => [step.verb, ...Object.entries(step.args).map(flagText)].join(' ');
const stepsText = (steps) => steps.map(stepText).join(' ; ');

// The fields of a step's answer the caller keeps; the rest is in the ledger.
const KEPT = ['ok', 'job_id', 'jobId', 'op', 'status', 'verdict', 'unit', 'settled', 'acked', 'messageId', 'toOwner'];
const briefOf = (out) => Object.fromEntries(KEPT.filter((key) => out?.[key] !== undefined).map((key) => [key, out[key]]));

/** Runs the steps in order and stops at the first failure: [{verb, ok, out?, code?, error?}]. */
async function runSteps(ctx, steps, decisionId) {
  const done = [];
  await findInOrder(steps, async (step) => {
    const answer = await runVerbInProcess(ctx, step.verb, { ...step.args, repo: ctx.repo, json: true, decision: decisionId, ...(ctx.args.by ? { by: ctx.args.by } : {}) });
    done.push({ verb: step.verb, ok: answer.ok, ...(answer.ok ? { out: briefOf(answer.out) } : { code: answer.code, error: String(answer.error ?? '').slice(0, 400) }) });
    return !answer.ok;
  });
  return done;
}

/** Resolves the item's Decision Item with the first step verb it allows; false when it allows none or already closed. */
function resolveItem(ctx, item, steps, decisionId) {
  if (!item.di) return false;
  const verbs = steps.length ? steps.map((step) => step.verb).reverse() : [];
  for (const verb of verbs.length ? verbs : ['decide']) {
    try {
      resolveDecision(ctx.ledger, item.di, { by: `kernel:${ctx.args.workflow}`, verb: `starci kernel ${verb}`, decisionId, note: ctx.args.reason });
      return true;
    } catch (error) { if (error?.code !== 'decision-verb-not-allowed') return false; }
  }
  return false;
}

/** none-fits: the item's Decision Item goes up one level; an item without one opens the Supervisor's menu-escape item. */
function escalate(ctx, item, reason) {
  const by = `kernel:${ctx.args.workflow}`;
  if (item.di) return escalateDecision(ctx.ledger, item.di, { to: 'supervisor', by, reason }).id;
  const opened = openDecisionRow(ctx.ledger, { workflowId: ctx.args.workflow, kind: 'menu-escape', decider: 'supervisor', entity: { type: 'workflow', id: ctx.args.workflow },
    idempotencyKey: `menu-escape:${ctx.args.workflow}:${item.id}`, summary: `Kernel: no option of ${item.id} fits: ${reason}`.slice(0, 300),
    evidence: item.evidence, by });
  return opened.di.id;
}

/** The answer of a decide that executed: what ran, what it returned, the decision and the item it closed. */
const answerOf = ({ ctx, item, option, entry, done, resolved, escalatedTo }) => {
  const failed = done.find((step) => !step.ok) ?? null;
  const out = { ok: !failed, workflowId: ctx.args.workflow, item: item.id, choice: option.choice, decision: entry.id, effect: option.effect, steps: done,
    ...(resolved ? { resolved: item.di } : {}), ...(escalatedTo ? { escalated: escalatedTo } : {}),
    ...(failed ? { code: 'menu-step-failed', error: `${failed.verb}: ${failed.code ?? 'failed'}: ${failed.error ?? ''}`.slice(0, 500) } : {}) };
  const escalation = escalatedTo ? `; escalated to the Supervisor as ${escalatedTo}` : '';
  const text = failed ? `decide FAILED at ${failed.verb} (${failed.code}): ${failed.error}` : `decided ${item.id} -> ${option.choice} (${entry.id}): ${option.effect}${escalation}`;
  return { out, text };
};

export async function decideMenuItem(ctx) {
  const { args, ledger, repo, emit } = ctx;
  const wf = args.workflow, now = Date.now();
  const reason = String(args.reason ?? '').trim();
  if (!args.choice || !reason) throw Object.assign(new Error('decide --item needs --choice <choice> and --reason <why>'), { code: 'decide-answer-incomplete' });
  const menu = await currentMenu(ctx);
  const item = menu.find((entry) => entry.id === args.item);
  if (!item) return refuseWithMenu(ctx, menu, { code: 'menu-item-unknown', error: `${args.item} is not an open item of ${wf}'s menu` });
  const option = item.options.find((entry) => entry.choice === args.choice);
  if (!option) return refuseWithMenu(ctx, menu, { code: 'menu-choice-unknown', error: `${args.choice} is not a choice of ${item.id} (${item.options.map((entry) => entry.choice).join(', ')})` });
  if (option.direct) return refuseWithMenu(ctx, menu, { code: 'menu-direct-option', error: `${option.choice} of ${item.id} is run directly: ${option.effect}` });
  const text = option.escape ? reason : String(args.text ?? '').trim();
  if (option.text && !option.escape && !text && !option.optionalText && JSON.stringify(option.steps).includes(TEXT)) {
    return refuseWithMenu(ctx, menu, { code: 'menu-text-missing', error: `${item.id} ${option.choice} needs --text <${option.text}>` });
  }
  const steps = boundSteps(option, text);
  const entry = openEntry({ ledger, repo, workflowId: wf, hypothesis: reason, actionKey: `${option.choice}:${item.id}:${now.toString(36)}`, metric: `${item.kind} ${item.id} resolved`,
    command: stepsText(steps) || option.choice, now, extra: { menu: { item: item.id, choice: option.choice, facts: itemFactsOf(item) }, evidence: String(args.evidence ?? '').split(',').map((ref) => ref.trim()).filter(Boolean) } });
  const done = option.escape ? [] : await runSteps(ctx, steps, entry.id);
  const failed = done.some((step) => !step.ok);
  const escalatedTo = option.escape ? escalate(ctx, item, reason) : null;
  const resolved = !failed && !option.escape && !option.snooze && resolveItem(ctx, item, steps, entry.id);
  closeEntry({ ledger, repo, workflowId: wf, entry: { id: entry.id, actionKey: entry.payload.actionKey, baseline: entry.baseline }, result: failed ? 'revert' : 'keep',
    observed: failed ? `${done.find((step) => !step.ok).verb} failed: ${done.find((step) => !step.ok).code}` : `${option.choice} executed (${done.length} step(s))`, now: Date.now() });
  const { out, text: line } = answerOf({ ctx, item, option, entry, done, resolved, escalatedTo });
  emit(out, line, args.json);
  if (failed) process.exitCode = 1;
  return undefined;
}
