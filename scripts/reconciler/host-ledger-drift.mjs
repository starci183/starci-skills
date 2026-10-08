// host-ledger-drift.mjs — the typed event for a difference between what the host shows and what the ledger claims. The Host, GC and Job
// controllers open an SLA clock the moment they see one (a terminal count above the active workers, a process of no running workflow, a seat
// that takes no input, a worktree nobody owns, a reservation behind no job, a lease nobody holds); the clock's own bound is the declared
// bound of the drift. When a clock of such a code (modules/reconciler/sla.yaml `driftKind`) is violated, the difference has outlived its bound,
// and when a violated one clears the host and the ledger agree again: each writes one `signal.host-ledger-drift` row with the kind of thing,
// the code, the entity, the bound and the age. `starci debug digest` answers rr-claimed-vs-observed from these rows.
import { SIGNAL, signalRow } from '../machine/debug-signals.mjs';

/** The kinds of thing whose host observation and ledger claim a drift code compares. */
export const DRIFT_KINDS = Object.freeze(['terminal', 'process', 'seat', 'worktree', 'reservation', 'lease']);

function driftRow({ ev }, state, now) {
  const entity = `${ev.entity.type}:${ev.entity.id}`;
  return signalRow(SIGNAL.hostDrift, `host and ledger differ (${ev.driftKind}) ${state}: ${ev.code} ${entity}`,
    { driftKind: ev.driftKind, code: ev.code, entity, ledger: ev.entity.ledger ?? null, state, slaMs: ev.slaMs, ageMs: ev.ageMs, enteredAt: ev.enteredAt, ...(state === 'cleared' ? { clearedAt: ev.clearedAt } : {}) },
    { at: now, workflowId: ev.entity.workflowId ?? null });
}

/** The machine_logs rows for the violations and clears of one SLA pass: one per violated/cleared episode whose code names a drift kind. */
export function driftRows({ toViolate, toClear, now }) {
  const drifting = (x) => DRIFT_KINDS.includes(x.ev.driftKind);
  return [...toViolate.filter(drifting).map((x) => driftRow(x, 'open', now)), ...toClear.filter(drifting).map((x) => driftRow(x, 'cleared', now))];
}
