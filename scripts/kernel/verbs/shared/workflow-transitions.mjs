// api-lib/lifecycle.mjs — the workflow phase machine the api verbs read and `starci kernel lifecycle` writes.
// It is DBTREE workflow_transitions (engine/db/schema/runtime.sql): the phases, the allowed
// moves and who may take them. A stopped workflow comes back only through the owner (Q14, MB-08);
// a paused one is resumed by the owner or the Supervisor. `archived_at` is the archived phase.
const WORKFLOW_TRANSITIONS = Object.freeze([
  ['awaiting-approval', 'queued'], ['awaiting-approval', 'stopped'],
  ['queued', 'running'], ['queued', 'stopped'],
  ['running', 'paused'], ['running', 'stopped'], ['running', 'finished'],
  ['paused', 'running'], ['paused', 'stopped'],
  ['stopped', 'queued'],
  ['stopped', 'archived'], ['finished', 'archived'],
]);
/** Phases a new job may be enqueued in (jobs_enqueue_guard). */
export const ACCEPTS_WORK = Object.freeze(['queued', 'running']);
/** Phases an op may be dispatched in (op_attempts_dispatch_guard: the first dispatch moves queued → running). */
export const DISPATCHES = Object.freeze(['queued', 'running']);

/** The phase a workflow row is in; an archived row is `archived` whatever its phase column says. */
export const phaseOf = (wf) => (!wf ? null : wf.archived_at != null ? 'archived' : wf.phase ?? 'queued');
export const canTransition = (from, to) => WORKFLOW_TRANSITIONS.some(([a, b]) => a === from && b === to);

/** Throw a typed refusal unless `wf` is in one of `phases`. */
export function requirePhase(wf, phases, verb) {
  const phase = phaseOf(wf);
  if (!wf) throw Object.assign(new Error(`${verb}: unknown workflow`), { code: 'workflow-unknown' });
  if (phases.includes(phase)) return phase;
  throw Object.assign(new Error(`${verb} refused: workflow ${wf.workflow_id} is ${phase}; ${verb} runs only while ${phases.join('|')}`),
    { code: phase === 'finished' ? 'workflow-finished' : phase === 'archived' ? 'workflow-archived' : 'workflow-not-accepting-work', phase });
}
