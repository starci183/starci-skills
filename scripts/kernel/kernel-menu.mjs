// kernel-menu.mjs — the Kernel's menu: the ordered decision points of one workflow, each with the typed options that answer it.
// Pure over its sources (scripts/kernel/verbs/shared/status-menu.mjs reads them from the ledger and the status projection); the
// kinds, options and the classification of every next-action origin are data in modules/kernel/kernel-menu.yaml. The menu adds
// no policy: who handles a situation, its chain and its deadline come from the hold table (modules/kernel/op-incident-policy.yaml).
import fs from 'node:fs';
import { escapeOptionOf, fillTemplate } from '../lib/menu-parts.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { boundValue } from './op-incident-policy.mjs';
import { holdView } from './terminal-step.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let cached = null;
// The caller's --text input: `starci kernel decide` binds it to every argument that holds this placeholder.
const TEXT = '$text';

/** The menu catalog (modules/kernel/kernel-menu.yaml). */
export const menuCatalog = () => (cached ??= parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'kernel', 'kernel-menu.yaml'), 'utf8')));

/** The origin row of a next action, or null for an action without a known origin. */
export const originOf = (action) => menuCatalog().origins.find((row) => row.id === action?.origin) ?? null;

/** The snooze of a chosen wait, in ms. */
export const snoozeMs = () => boundValue(menuCatalog().snooze.ms);

/** The arguments of a step with `$name` values taken from the subject; a value the subject does not know drops the flag. */
export function resolveArgs(args, subject) {
  const out = {};
  for (const [key, raw] of Object.entries(args ?? {})) {
    if (raw === TEXT) { out[key] = TEXT; continue; }
    const value = typeof raw === 'string' && raw.startsWith('$') ? subject[raw.slice(1)] : raw;
    if (value == null || value === '') continue;
    out[key] = value === true ? true : String(value);
  }
  return out;
}

/** One option as the menu shows it: `verb` and `args` are the last step's, `steps` every step. */
function optionOf(spec, subject) {
  const steps = (spec.steps ?? []).map((step) => ({ verb: step.verb, args: resolveArgs(step.args, subject) }));
  const last = steps.at(-1) ?? null;
  return { choice: spec.choice, verb: last?.verb ?? null, args: last?.args ?? null, steps, effect: fillTemplate(spec.effect, subject),
    ...(spec.text ? { text: spec.text } : {}), ...(spec.optionalText ? { optionalText: true } : {}), ...(spec.direct ? { direct: true } : {}), ...(spec.snooze ? { snooze: true } : {}) };
}

const jobOption = (option) => ({ choice: option.key, verb: option.steps.at(-1)?.verb ?? null, args: option.steps.at(-1)?.args ?? null, steps: option.steps, effect: option.title });

/** The options a Decision Item carries that run as a Kernel verb (`starci kernel <verb> --flag value`); the others are prose and are not offered. */
function diOptionsOf(di, subject) {
  return (di.options ?? []).flatMap((o, index) => {
    const step = parseKernelCommand(o.verb);
    return step ? [{ choice: String(o.key ?? `option-${index + 1}`), verb: step.verb, args: { ...step.args, workflow: subject.workflow }, steps: [{ verb: step.verb, args: { ...step.args, workflow: subject.workflow } }], effect: String(o.title ?? o.verb).slice(0, 200) }] : [];
  });
}

/** `starci kernel <verb> [--flag [value]]...` as {verb, args}, or null for any other text. */
export function parseKernelCommand(text) {
  const words = String(text ?? '').match(/'[^']*'|"[^"]*"|\S+/g)?.map((w) => w.replace(/^(['"])(.*)\1$/, '$2')) ?? [];
  if (words[0] !== 'starci' || words[1] !== 'kernel' || !words[2] || words[2].startsWith('-')) return null;
  const args = {};
  for (let i = 3; i < words.length; i += 1) {
    if (!words[i].startsWith('--')) return null;
    const next = words[i + 1];
    const takesValue = next !== undefined && !next.startsWith('--') && !/^<.*>$/.test(next);
    if (next !== undefined && /^<.*>$/.test(next)) return null;
    args[words[i].slice(2)] = takesValue ? next : true;
    if (takesValue) i += 1;
  }
  if (args.repo !== undefined) delete args.repo;
  return { verb: words[2], args };
}

const escapeOption = () => escapeOptionOf(menuCatalog().escape, { verb: null, args: null });

/** A time as epoch ms: a number as it is, an ISO string parsed, anything else null. */
const msOf = (value) => {
  if (value == null) return null;
  const ms = typeof value === 'string' ? Date.parse(value) : Number(value);
  return Number.isFinite(ms) ? ms : null;
};

/** The step line and deadline the hold table gives a situation: {step, deadlineAt}. */
function policyOf(hold, sinceRaw) {
  if (!hold) return { step: 'kernel', deadlineAt: null };
  const since = msOf(sinceRaw);
  const view = holdView(hold);
  const at = view.chain.indexOf('kernel');
  const next = at >= 0 ? view.chain[at + 1] : null;
  return { step: next ? `${view.handler}, then ${next}` : view.handler, deadlineAt: since == null || view.deadlineMs == null ? null : since + view.deadlineMs };
}

const kindOf = (id) => menuCatalog().kinds.find((kind) => kind.id === id);

/** One menu item from a kind, a subject and the options its builder produced (else the kind's own). */
function itemOf(kind, { key, subject, options = null, since = null, evidence = [], di = null, deadlineAt = null }) {
  const spec = kindOf(kind);
  const policy = policyOf(spec.hold, since);
  const own = options ?? (spec.options ?? []).map((option) => optionOf(option, subject));
  return {
    id: `${kind}:${key}`, kind, mode: spec.mode, subject: { ...subject }, question: fillTemplate(spec.question, subject),
    options: [...own, escapeOption()], evidence, deadline: deadlineAt ?? policy.deadlineAt, step: policy.step, hold: spec.hold ?? null, di,
  };
}

const jobItem = ({ di, resolution }, workflow) => {
  const subject = { workflow, job: resolution.jobId, op: resolution.op ?? null, situation: resolution.what, summary: di.summary };
  return itemOf('job-decision', { key: resolution.jobId, subject, options: resolution.options.map(jobOption), since: di.openedAt ?? null,
    evidence: [{ ref: `job:${resolution.jobId}` }, ...(di.evidence ?? []).slice(0, 6)], di: di.id ?? null });
};

const questionItem = (q, workflow) => itemOf('worker-question', { key: q.messageId, subject: { workflow, message: q.messageId, job: q.jobId, op: q.opId, ask: q.question },
  since: q.askedAt ?? null, evidence: [{ ref: `worker-question:${q.messageId}` }] });

const peerItem = (m, workflow) => itemOf('peer-message', { key: m.key, subject: { workflow, key: m.key, from: m.from, messageKind: m.kind, subject: m.subject },
  since: m.at ?? null, evidence: [{ ref: `peer-message:${m.key}` }] });

const wedgedItem = (w, workflow) => itemOf('worker-wedged', { key: w.jobId, subject: { workflow, job: w.jobId, op: w.opId ?? w.op ?? null }, evidence: [{ ref: `job:${w.jobId}` }] });

const diItem = (di, workflow) => {
  const subject = { workflow, summary: di.summary, di: di.id };
  const spec = kindOf('decision-item');
  const snoozable = spec.snoozeKinds.includes(di.kind) ? [{ choice: 'keep-waiting', verb: null, args: null, steps: [], snooze: true, effect: 'asks again after the snooze' }] : [];
  return itemOf('decision-item', { key: di.id, subject, options: [...diOptionsOf(di, subject), ...snoozable], since: di.openedAt ?? null, deadlineAt: di.dueAt ?? null,
    evidence: [{ ref: `decision:${di.id}` }, ...(di.evidence ?? []).slice(0, 6)], di: di.id });
};

const waitItem = (wait, workflow) => itemOf('dead-wait', { key: wait.incidentId, subject: { workflow, incident: wait.incidentId, situation: wait.situation }, evidence: [{ ref: `incident:${wait.incidentId}` }] });

const revItem = (rev, workflow) => itemOf('rev-ack', { key: workflow, subject: { workflow, acked: String(rev.acked ?? '').slice(0, 9), rev: rev.current }, evidence: [{ ref: `runtime-rev:${rev.current}` }] });

/** The items one next action raises, or [] when the action is a wait, a mechanical move the controllers perform or has no menu kind. */
function actionItemOf(action, workflow) {
  const origin = originOf(action);
  // A move a supervisor-gate or a peer-wait holds is theirs to release, not the Kernel's to answer.
  if (origin?.class !== 'judgment' || !origin.menu || action.heldBy) return [];
  const subject = { workflow, op: action.op ?? null, job: action.jobId ?? null, node: action.nodes?.[0] ?? null, paths: action.paths ?? null, params: action.params ?? null, situation: action.reason };
  const key = [action.op, action.jobId ?? action.nodes?.[0] ?? action.cutId, origin.id].filter(Boolean).join(':');
  return [itemOf(origin.menu, { key, subject, evidence: action.jobId ? [{ ref: `job:${action.jobId}` }] : [] })];
}

/** The typed choices that route a reported defect: one per slice the workflow built, and one per record gap (requirement, design, interface). */
function feedbackOptionsOf(feedback, slices, subject) {
  const sliceOptions = slices.map((slice) => ({ choice: `${feedback.slicePrefix}${slice.jobId}`, verb: slice.move.verb, args: slice.move.args, steps: [slice.move],
    effect: fillTemplate(feedback.sliceEffect, { op: slice.op, job: slice.jobId, label: slice.label }) }));
  const gapOptions = feedback.gaps.map((gap) => optionOf({ choice: gap.choice, text: 'paths', effect: gap.effect,
    steps: [{ verb: 'enqueue', args: { workflow: '$workflow', op: gap.op, paths: TEXT, title: '$title' } }] }, subject));
  return [...sliceOptions, ...gapOptions];
}

const handoverItems = (handover, workflow, report) => {
  if (!['answered'].includes(handover?.state) && !handover?.due) return [];
  const paths = `.starciwork/evidence/${workflow}.handover`;
  const feedback = handover.state === 'answered' && handover.ask?.decision === 'feedback';
  const spec = kindOf('handover-step');
  const state = handover.state === 'answered' ? 'answered' : 'due';
  const situation = feedback ? `the owner reported a defect on handover ask ${handover.ask.dispatchId}` : `handover is ${state}`;
  const subject = { workflow, paths, situation, title: report?.title };
  const options = feedback ? feedbackOptionsOf(spec.feedback, report?.slices ?? [], subject) : (spec.options ?? []).map((option) => optionOf(option, subject));
  return [itemOf('handover-step', { key: workflow, subject, options })];
};

const sinceOf = (item) => item.deadline ?? Number.MAX_SAFE_INTEGER;

/**
 * The menu: [{id, kind, mode, subject, question, options: [{choice, verb, args, steps, effect}], evidence, deadline, step, hold, di}].
 * `sources`: {workflow, rev, jobDecisions: [{di, resolution}], questions, peers, wedged, deadWaits, decisions, nextActions, handover, feedback ({title, slices}, scripts/kernel/handover-slices.mjs), snoozed: Set of item ids}.
 */
export function buildMenu(sources) {
  const { workflow } = sources;
  const items = [
    ...(sources.rev?.stale ? [revItem(sources.rev, workflow)] : []),
    ...sources.jobDecisions.map((entry) => jobItem(entry, workflow)),
    ...sources.questions.map((q) => questionItem(q, workflow)),
    ...sources.peers.map((m) => peerItem(m, workflow)),
    ...sources.wedged.map((w) => wedgedItem(w, workflow)),
    ...sources.deadWaits.map((wait) => waitItem(wait, workflow)),
    ...sources.decisions.map((di) => diItem(di, workflow)),
    ...sources.nextActions.flatMap((action) => actionItemOf(action, workflow)),
    ...handoverItems(sources.handover, workflow, sources.feedback),
  ];
  const seen = new Set();
  return items.filter((item) => !sources.snoozed.has(item.id) && !seen.has(item.id) && seen.add(item.id))
    .sort((a, b) => (a.mode === 'duty' ? 0 : 1) - (b.mode === 'duty' ? 0 : 1) || (a.mode === 'mechanical-pending' ? 1 : 0) - (b.mode === 'mechanical-pending' ? 1 : 0) || sinceOf(a) - sinceOf(b));
}
