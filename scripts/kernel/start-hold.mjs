// start-hold.mjs - the bound on a Kernel launch that fails again for the same cause.
//
// A failed Kernel launch is a recorded event (`kernel-start-failed`). The same step failing for the same cause again and again
// is not a retry any more, it is one problem: the launch backs off between attempts and, once the declared number of failures
// of one cause is spent, is held until the declared hold has passed. The numbers are modules/reconciler/host.yaml
// seats.kernel (startRetryMs, startRetryMaxMs, startSameCauseMax, startHeldRetryMs); the hold row is `kernel-start-held` of
// modules/kernel/op-incident-policy.yaml. The ledger is the record, so every caller of a launch reads the same answer.
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { nextRetry } from '../lib/retry-budget.mjs';
import { KERNEL_LAUNCH_EVENTS } from '../machine/terminal-ledger.mjs';

const BUDGET_KEYS = ['startRetryMs', 'startRetryMaxMs', 'startSameCauseMax', 'startHeldRetryMs'];

/** The declared numbers of the launch bound, each a positive number or a refusal naming the key. */
export function startHoldBudget(read = readModuleJson) {
  const seat = read('modules', 'reconciler', 'host.yaml')?.seats?.kernel ?? {};
  for (const key of BUDGET_KEYS) {
    if (!(Number(seat[key]) > 0)) throw new Error(`modules/reconciler/host.yaml seats.kernel.${key} must be a positive number`);
  }
  return { intervalMs: Number(seat.startRetryMs), maxIntervalMs: Number(seat.startRetryMaxMs), maxAttempts: Number(seat.startSameCauseMax), heldRetryMs: Number(seat.startHeldRetryMs) };
}

/** The cause of one failure: its step and its typed reason, else the first line of its error with numbers folded away. Pure. */
export function startCauseOf({ step, reason, error }) {
  const typed = reason ?? `error:${String(error ?? '').split('\n')[0].trim().replace(/\d+/g, '#').slice(0, 120)}`;
  return `${step ?? 'unknown'}|${typed}`;
}

/** The failed launches since the last Kernel launch that stood, oldest first, one per launch (a fall-through to the next member is not one). */
export function startFailureRun(db, workflowId) {
  const launched = db.prepare(`SELECT max(created_at) AS at FROM events WHERE workflow_id=? AND kind IN (${KERNEL_LAUNCH_EVENTS.map(() => '?').join(',')})`).get(workflowId, ...KERNEL_LAUNCH_EVENTS)?.at ?? 0;
  const rows = db.prepare("SELECT created_at, payload_json FROM events WHERE workflow_id=? AND kind='kernel-start-failed' AND created_at>? ORDER BY seq").all(workflowId, launched);
  return rows.map((r) => ({ at: r.created_at, payload: parseJsonOr(r.payload_json) })).filter((r) => !r.payload.fellThroughTo)
    .map((r) => ({ at: r.at, step: r.payload.step ?? null, reason: r.payload.reason ?? null, error: String(r.payload.error ?? ''),
      cause: startCauseOf(r.payload), receipt: r.payload.install?.receipt ?? null }));
}

const evidenceOf = (group, last) => ({ cause: group[0].cause, step: group[0].step, reason: group[0].reason, count: group.length, firstAt: group[0].at, lastAt: last.at,
  error: group.at(-1).error.slice(0, 600), lockedPath: group.at(-1).receipt?.path ?? null, holders: group.at(-1).receipt?.holders ?? null });

/**
 * Whether a launch may run now: null when it may, else {state: 'backoff' | 'held', retryAtMs, ...evidence}. The cause with the most
 * failures in the run decides (an alternation of two causes is still a loop); a launch after a spent bound is let through once
 * the declared hold has passed, and its failure is a new event that holds it again. Pure.
 */
export function startHoldOf(run, { now, budget }) {
  if (!run.length) return null;
  const groups = Map.groupBy(run, (r) => r.cause);
  const worst = [...groups.values()].sort((a, b) => b.length - a.length || b.at(-1).at - a.at(-1).at)[0];
  const last = run.at(-1);
  const verdict = nextRetry(budget, { attempts: worst.length, firstAt: worst[0].at, now: last.at, reason: worst[0].cause });
  if (verdict.exhausted) {
    const retryAtMs = last.at + budget.heldRetryMs;
    return now < retryAtMs ? { state: 'held', retryAtMs, ...evidenceOf(worst, last) } : null;
  }
  return now < verdict.dueAt ? { state: 'backoff', retryAtMs: verdict.dueAt, ...evidenceOf(worst, last) } : null;
}

/** One sentence naming a hold for a Decision Item or a refusal: the step, how many launches failed for it, and until when. Pure. */
export function holdSummary(hold) {
  const until = hold.retryAtMs ? `; the next launch is due ${new Date(hold.retryAtMs).toISOString()}` : '';
  const where = hold.lockedPath ? ` (a file of the tree is held open: ${hold.lockedPath})` : '';
  return `${hold.count} Kernel launches failed at ${hold.step} for one cause, ${hold.state}${where}${until}`;
}
