// runtime-deploy-inflight.mjs - the steps of the running system a restart must not cut in the middle, read from the marks the engine and the settler leave.
//   engine action   machine engine_actions in state intent|running of the CURRENT engine epoch: a child verb the engine started and has not finished. A settle, and
//                   the Critic run a settle owes (the settler runs the Critic inside its own process), are such actions; a row of an earlier epoch belongs to a dead engine.
//   settle tail     a ledger settle_tails row in state running that started after the current engine process started.
//   prepared        a ledger `workflow-op-preserved-prepared` receipt with no applied, withdrawn or kept event after it, written after the current engine
//                   process started: its apply is under way. An older open receipt is a dead apply; the settler recovers it (settle/prepared-recovery.mjs) on the
//                   next attempt, so a restart neither loses nor repeats it.
//   process         an open process_runs row of a settler, a land or a push whose pid is alive.
// The deploy waits for these to finish (waitForQuiet) and refuses when they do not: it never stops one.
import { pidAlive } from '../../engine/db/machine.mjs';
import { PREPARED_WITHDRAWN } from '../kernel/workflow-checkpoint-state.mjs';
import { PREPARED_KEPT } from '../kernel/settle/prepared-recovery.mjs';
import { sleep as sleepFor } from '../lib/sleep.mjs';
import { repeatInOrder } from '../lib/in-order.mjs';

const LIVE_ROLES = Object.freeze(['settler', 'land', 'push']);
const PREPARED = 'workflow-op-preserved-prepared';
const APPLIED = 'workflow-op-preserved-applied';

const TAILS_SQL = "SELECT workflow_id, attempt_id, started_at FROM settle_tails WHERE state='running' AND started_at>=?";
const PREPARED_SQL = `SELECT p.entity_id AS job_id, p.workflow_id, p.created_at FROM events p WHERE p.kind=? AND p.created_at>=?
  AND NOT EXISTS (SELECT 1 FROM events a WHERE a.entity_id=p.entity_id AND a.attempt_id IS p.attempt_id AND a.seq>p.seq AND a.kind IN (?,?,?))`;

function machineSteps(machine, leader) {
  const actions = leader.fresh && leader.epoch != null
    ? machine.db.prepare("SELECT controller, key, verb, started_at FROM engine_actions WHERE state IN ('intent','running') AND epoch=?").all(leader.epoch)
      .map((row) => ({ kind: 'engine-action', controller: row.controller, key: row.key, verb: row.verb, startedAt: row.started_at })) : [];
  const processes = machine.openProcessRuns().filter((row) => LIVE_ROLES.includes(row.role) && pidAlive(row.pid))
    .map((row) => ({ kind: 'process', role: row.role, pid: row.pid, startedAt: row.started_at }));
  return [...actions, ...processes];
}

function ledgerSteps(machine, since) {
  return machine.forEachLedger(({ ledger, db }) => [
    ...db.prepare(TAILS_SQL).all(since).map((row) => ({ kind: 'settle-tail', ledger: ledger.name ?? ledger.ledger_id, workflow: row.workflow_id, attempt: row.attempt_id, startedAt: row.started_at })),
    ...db.prepare(PREPARED_SQL).all(PREPARED, since, APPLIED, PREPARED_WITHDRAWN, PREPARED_KEPT)
      .map((row) => ({ kind: 'prepared-decision', ledger: ledger.name ?? ledger.ledger_id, workflow: row.workflow_id, job: row.job_id, startedAt: row.created_at })),
  ]).flatMap((entry) => entry.result ?? []);
}

// When the current engine process started (ms), or null when no engine leads: a mark older than that belongs to a dead process.
const engineStartedAt = (machine, leader) => (leader.fresh && leader.runId != null
  ? Number(machine.db.prepare('SELECT started_at FROM process_runs WHERE run_id=?').get(leader.runId)?.started_at ?? 0) : null);

/** The steps in flight right now: [{kind, ...}]. `machine` is an open machine store, `leader` boot.mjs leaderState(). */
export function inFlightSteps({ machine, leader }) {
  const since = engineStartedAt(machine, leader);
  return [...machineSteps(machine, leader), ...(since == null ? [] : ledgerSteps(machine, since))];
}

/** One line per step, for the refusal and the plan. */
export const stepLine = (step) => [step.kind, step.controller ?? step.role ?? step.ledger, step.key ?? step.workflow ?? step.pid, step.job ?? step.attempt ?? step.verb].filter((part) => part != null).join(' ');

/**
 * Polls `scan()` until it finds no step or `waitMs` has passed: {quiet, steps, waitedMs}. The deploy waits; the steps finish by themselves.
 */
export async function waitForQuiet({ scan, waitMs, pollMs, now = Date.now, sleep = sleepFor }) {
  const start = now();
  return repeatInOrder(async () => {
    const steps = scan();
    if (!steps.length || now() - start >= waitMs) return { quiet: steps.length === 0, steps, waitedMs: now() - start };
    await sleep(pollMs);
    return undefined;
  });
}
