// menu-decide.mjs — `starci kernel decide --item <id> --choice <choice> --reason <why>`: one typed answer to one item of the menu.
// The answer is validated against the menu as the ledger shows it now, recorded in the Kernel's decision log, then executed: the
// option's steps run in this process through the same `run` the standalone verbs have (verb-inproc.mjs). A choice that is not on
// the menu is refused with a typed code and the menu. `none-fits` records the reason and escalates the item up the role chain.
import { closeEntry, openEntry } from '../../decision-log.mjs';
import { escalateDecision, openDecisionRow, resolveDecision } from '../../../machine/decisions.mjs';
import { answerMenuItem, answerOf, incompleteAnswer, runUntilFailure } from '../../../lib/menu-answer.mjs';
import { refuseVerb } from './verb-exit.mjs';
import { runVerbInProcess } from './verb-inproc.mjs';
import { itemFactsOf } from '../../kernel-menu.mjs';
import { currentRuntimeRev } from '../../runtime-rev.mjs';
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
const bindArg = ([key, value], text, json) => {
  if (typeof value === 'string' && value.startsWith(`${TEXT}.`)) {
    const part = json?.[value.slice(TEXT.length + 1)];
    return part == null ? [] : [[key, typeof part === 'string' ? part : JSON.stringify(part)]];
  }
  if (value !== TEXT) return [[key, value]];
  return text ? [[key, text]] : [];
};
/** The --text read as one JSON object, for the arguments that take a part of it (`$text.paths`); a text that is no object is refused. */
function jsonTextOf(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* refused below */ }
  throw Object.assign(new Error('this choice takes --text as one JSON object (see its effect)'), { code: 'menu-text-invalid' });
}
const boundSteps = (option, text) => {
  const json = JSON.stringify(option.steps).includes(`"${TEXT}.`) ? jsonTextOf(text) : null;
  return option.steps.map((step) => ({ verb: step.verb, args: Object.fromEntries(Object.entries(step.args ?? {}).flatMap((entry) => bindArg(entry, text, json))) }));
};

const flagText = ([key, value]) => (value === true ? `--${key}` : `--${key} ${String(value).slice(0, 60)}`);
const stepText = (step) => [step.verb, ...Object.entries(step.args).map(flagText)].join(' ');
const stepsText = (steps) => steps.map(stepText).join(' ; ');

// The fields of a step's answer the caller keeps; the rest is in the ledger.
const KEPT = ['ok', 'job_id', 'jobId', 'op', 'status', 'verdict', 'unit', 'settled', 'acked', 'messageId', 'toOwner'];
const briefOf = (out) => Object.fromEntries(KEPT.filter((key) => out?.[key] !== undefined).map((key) => [key, out[key]]));

/** Runs the steps in order and stops at the first failure: [{verb, ok, out?, code?, error?}]. */
const runSteps = (ctx, steps, decisionId) => runUntilFailure(steps, async (step) => {
  const answer = await runVerbInProcess(ctx, step.verb, { ...step.args, repo: ctx.repo, json: true, decision: decisionId, ...(ctx.args.by ? { by: ctx.args.by } : {}) });
  return { verb: step.verb, ok: answer.ok, ...(answer.ok ? { out: briefOf(answer.out) } : { code: answer.code, error: String(answer.error ?? '').slice(0, 400) }) };
});

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
const renderAnswer = ({ ctx, item, option, recorded: { entry }, done, failed, closed: resolved, escalation: escalatedTo }) => {
  const out = answerOf({ item, option, done }, { workflowId: ctx.args.workflow, decision: entry.id,
    ...(resolved ? { resolved: item.di } : {}), ...(escalatedTo ? { escalated: escalatedTo } : {}),
    ...(failed ? { code: 'menu-step-failed', error: `${failed.verb}: ${failed.code ?? 'failed'}: ${failed.error ?? ''}`.slice(0, 500) } : {}) });
  const escalation = escalatedTo ? `; escalated to the Supervisor as ${escalatedTo}` : '';
  const text = failed ? `decide FAILED at ${failed.verb} (${failed.code}): ${failed.error}` : `decided ${item.id} -> ${option.choice} (${entry.id}): ${option.effect}${escalation}`;
  return { out, text };
};

/** Records the Kernel's hypothesis and binds the option's steps to its caller text. */
function recordAnswer(ctx, { item, option, reason, text }) {
  const now = Date.now();
  const steps = boundSteps(option, text);
  const entry = openEntry({ ledger: ctx.ledger, repo: ctx.repo, workflowId: ctx.args.workflow, hypothesis: reason, actionKey: `${option.choice}:${item.id}:${now.toString(36)}`, metric: `${item.kind} ${item.id} resolved`,
    command: stepsText(steps) || option.choice, now, extra: { menu: { item: item.id, choice: option.choice, facts: itemFactsOf(item), rev: currentRuntimeRev() }, evidence: String(ctx.args.evidence ?? '').split(',').map((ref) => ref.trim()).filter(Boolean) } });
  return { entry, steps };
}

/** Closes the Kernel's hypothesis log after the shared decision flow. */
function finishAnswer(ctx, { recorded: { entry }, option, done, failed }) {
  closeEntry({ ledger: ctx.ledger, repo: ctx.repo, workflowId: ctx.args.workflow, entry: { id: entry.id, actionKey: entry.payload.actionKey, baseline: entry.baseline }, result: failed ? 'revert' : 'keep',
    observed: failed ? `${failed.verb} failed: ${failed.code}` : `${option.choice} executed (${done.length} step(s))`, now: Date.now() });
}

export async function decideMenuItem(ctx) {
  const { args, emit } = ctx;
  const reason = String(args.reason ?? '').trim();
  const incomplete = incompleteAnswer({ choice: args.choice, reason });
  if (incomplete) throw Object.assign(new Error(incomplete.error), { code: incomplete.code });
  const menu = await currentMenu(ctx);
  const result = await answerMenuItem({ menu, answer: args, menuName: `${args.workflow}'s menu` }, {
    demandsText: (option) => JSON.stringify(option.steps).includes(TEXT),
    record: (picked) => recordAnswer(ctx, picked),
    execute: ({ recorded }) => runSteps(ctx, recorded.steps, recorded.entry.id),
    escalate: ({ item, reason: why }) => escalate(ctx, item, why),
    resolve: ({ item, recorded }) => resolveItem(ctx, item, recorded.steps, recorded.entry.id),
    finish: (answered) => finishAnswer(ctx, answered),
  });
  if (result.refusal) return refuseWithMenu(ctx, menu, result.refusal);
  const { out, text: line } = renderAnswer({ ctx, ...result });
  emit(out, line, args.json);
  if (result.failed) process.exitCode = 1;
  return undefined;
}
