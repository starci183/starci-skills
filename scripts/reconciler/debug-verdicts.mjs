// debug-verdicts.mjs — turns the analysed digest and the operating-standard answers into the verdict of every role. A stop that the
// contracts already carry a step for is a happy error and only counted; a role or the runtime that does not do what its contract says
// is a BUG and the only thing that becomes a problem line. The role, the broken duty and the registry entry that tracks the remedy
// come from the `departures` table of modules/reconciler/operating-standard.yaml (one owner). Pure.
import { byCodeUnit } from '../lib/list.mjs';

const HANDLER_ROLE = Object.freeze({ 'runtime-auto': 'runtime', reconciler: 'runtime', kernel: 'kernel', supervisor: 'supervisor' });
// A problem of the digest whose truth the operating standard decides: [the step that answers it, whether its workflow owns the step].
const GATED = Object.freeze({ 'kernel-dead': ['kernel-booted', true], 'kernel-rev': ['kernel-acked-rev', true],
  'supervisor-down': ['supervisor-seat-live', false], 'supervisor-dead': ['supervisor-seat-live', false], 'supervisor-deaf': ['supervisor-seat-live', false] });
const HOST_CODES = new Set(['leader-missing', 'leader-stale', 'controllers-off', 'safe-mode', 'supervisor-down', 'supervisor-dead', 'supervisor-deaf']);

const handlerRole = (p) => HANDLER_ROLE[p.evidence?.handler ?? p.evidence?.decider ?? ''] ?? null;

/** The step answer a gated problem depends on: {state, departure}, or null when the snapshot has no such step. */
function gateAnswer(p, standard) {
  const [stepId, perWorkflow] = GATED[p.code];
  const steps = perWorkflow ? standard.workflows.find((w) => w.id === p.workflowId)?.steps : standard.host;
  return steps?.find((s) => s.id === stepId) ?? null;
}

/** A problem the digest built, as a verdict: {bug: finding} for a departure, {happy: kind} for a stop the design handles, {drop} for one the standard re-states or already counts. */
function classify(p, standard, defs) {
  if (p.code === 'leader-rev') return { happy: 'runtime-rev-pending', role: 'runtime' };
  if (GATED[p.code]) {
    const answer = gateAnswer(p, standard);
    if (answer && (answer.state !== 'overdue' || answer.departure !== p.code)) return { drop: true };
  }
  const def = defs.departures[p.code];
  if (!def) return { bug: { role: 'runtime', duty: 'does', registry: null } };
  const role = def.role === 'handler' ? handlerRole(p) : def.role;
  return role ? { bug: { role, duty: def.duty, registry: def.registry } } : { happy: 'owner-wait', role: 'kernel' };
}

const remedyOf = (registryId, registry) => {
  if (!registryId) return { state: 'none-recorded', case: null };
  const entry = registry.find((c) => c.id === registryId);
  if (!entry) return { state: 'none-recorded', case: registryId };
  return { state: entry.status === 'covered' ? (entry.remedy ?? 'in-tree') : 'open', case: registryId };
};

const blocksOf = (code, view, n) => {
  if (HOST_CODES.has(code)) return n.blocksEverything;
  if (code === 'reservation-leak' || code === 'job-past-deadline') return 1;
  if (code === 'kernel-rev') return n.revDriftBlocks;
  if (code === 'kernel-idle') return view?.kernel.readyWork ?? 1;
  return (view?.openWork ?? 0) + (code === 'kernel-start-loop' ? 1 : n.blocksDeparture);
};

const departureProblem = (step, ctx, view) => {
  const def = ctx.defs.departures[step.departure];
  if (!def) throw new Error(`operating-standard.yaml departures lack ${step.departure}`);
  const subject = view ? view.name : 'host';
  return { area: 'standard', blocks: blocksOf(step.departure, view, ctx.n), key: `${step.departure}-${view?.id ?? 'host'}`, code: 'departure', workflowId: view?.id ?? null,
    params: { step: step.id, subject, departure: step.departure, evidence: String(step.evidence).slice(0, 160) }, evidence: step, role: def.role, duty: def.duty, registry: def.registry };
};

/** The standard's own departures: an overdue step whose departure code the digest has not already named for that workflow. */
function standardDepartures(ctx, kept) {
  const named = new Set(kept.map((p) => `${p.code}|${p.workflowId ?? ''}`));
  const fresh = (step, view) => step.state === 'overdue' && step.departure && !named.has(`${step.departure}|${view?.id ?? ''}`);
  const host = ctx.standard.host.filter((s) => fresh(s, null)).map((s) => departureProblem(s, ctx, null));
  const flows = ctx.standard.workflows.flatMap((w) => {
    const view = ctx.views.find((v) => v.id === w.id);
    return w.steps.filter((s) => fresh(s, view)).map((s) => departureProblem(s, ctx, view));
  });
  return [...host, ...flows];
}

/** Happy kinds the standard's waiting answers carry: [{kind, role, workflowId}]. */
function standardHappy(ctx) {
  const of = (steps, workflowId) => steps.flatMap((s) => [s, ...(s.items ?? [])]).filter((s) => s.happy).map((s) => ({ kind: s.happy, role: ctx.defs.happy[s.happy]?.role ?? 'runtime', workflowId }));
  return [...of(ctx.standard.host, null), ...ctx.standard.workflows.flatMap((w) => of(w.steps, w.id))];
}

const happyAt = (kind, role, workflowId, attemptId = null) => ({ kind, role, workflowId, attemptId });
const OUTCOME_HAPPY = Object.freeze({ ask: 'op-asked', blocked: 'op-blocked' });

/** The stops of one workflow's attempts and events that the design handles. */
function attemptHappy(source) {
  const wf = source.id;
  const out = source.attempts.flatMap((a) => {
    if (OUTCOME_HAPPY[a.reportOutcome]) return [happyAt(OUTCOME_HAPPY[a.reportOutcome], 'op', wf, a.attemptId)];
    if (a.verdict === 'fail' && a.reportedAt !== null) return [happyAt('check-red', 'op', wf, a.attemptId)];
    return [];
  });
  const events = source.events ?? [];
  const quota = events.filter((e) => e.kind === 'provider-unavailable').map(() => happyAt('quota-wait', 'runtime', wf));
  const lastDispatch = events.filter((e) => e.kind === 'op-dispatched').reduce((at, e) => Math.max(at, Number(e.at)), 0);
  const refused = events.filter((e) => e.kind === 'dispatch-rejected' && Number(e.at) > lastDispatch).map(() => happyAt('dispatch-rejected', 'runtime', wf));
  return [...out, ...quota, ...refused];
}

/** The happy kind of a stopped leg the policy handles: its next step happened, the owner decides, or the step is still pending. */
function legKind(j) {
  if (j.stepTaken) return 'step-taken';
  return j.handler === 'owner' ? 'owner-wait' : 'step-pending';
}

/** The stops of one analysed workflow that its policy handles: held inside the bound, steps taken or pending, open Decision Items. */
function stopHappy(view) {
  const holdHappy = (h) => (h.handler === 'owner' ? happyAt('owner-wait', 'kernel', view.id) : happyAt('hold-inside-bound', HANDLER_ROLE[h.handler] ?? 'runtime', view.id));
  const held = view.held.filter((h) => !h.overdue).map((h) => holdHappy(h));
  const legs = view.judgements.filter((j) => j.reasonable).map((j) => happyAt(legKind(j), 'kernel', view.id));
  const decisions = view.decisions.map(() => happyAt('decision-open', 'kernel', view.id));
  return [...held, ...legs, ...decisions];
}

/** Every happy error of the snapshot as [{kind, role, workflowId, attemptId}]. */
function happyFindings(ctx, converted) {
  const fromViews = ctx.views.flatMap((v) => [...stopHappy(v), ...attemptHappy(v.source)]);
  return [...fromViews, ...standardHappy(ctx), ...converted.map((c) => happyAt(c.happy, c.role, c.workflowId ?? null))];
}

/**
 * The verdicts of one digest. `ctx`: {n, defs (the loaded standard), standard (judgeStandard's answer), views ([{id, name, kernel, held,
 * judgements, decisions, running, openWork, source}]), registry, problems (the digest's own problem list)}. Returns {bugs, happy}:
 * `bugs` are the problem lines (departures), `happy` the counted stops.
 */
export function classifyAll(ctx) {
  const bugs = [], converted = [];
  for (const p of ctx.problems) {
    const verdict = classify(p, ctx.standard, ctx.defs);
    if (verdict.bug) bugs.push({ ...p, ...verdict.bug });
    else if (verdict.happy) converted.push({ happy: verdict.happy, role: verdict.role, workflowId: p.workflowId });
  }
  const all = [...bugs, ...standardDepartures(ctx, bugs)].map((p) => ({ ...p, remedy: remedyOf(p.registry, ctx.registry) }));
  return { bugs: all.sort((a, b) => b.blocks - a.blocks || byCodeUnit(a.key, b.key)), happy: happyFindings(ctx, converted) };
}
