// autopilot-budget-gate.mjs — the supervisor-gate the runtime raises against a workflow's own budget, and its own release.
// A cap actually exceeded, or token usage still unknown after the metering window, opens one gate holding every job ('*');
// the gate is the runtime's to clear: the first evaluation that finds the condition gone resolves it with the new budget as
// evidence, so a gate raised before the usage sweep ran never waits for a human. An exceeded cap still needs the Supervisor.
import { resolveIncident } from '../../engine/db/ledger.mjs';
import { AUTOPILOT_BY, supervisorGatesOf, openSupervisorGate } from './autopilot-budget.mjs';
import { AUTOPILOT_EVENTS } from './autopilot-state.mjs';

const BUDGET_GATE_DETAIL = 'autopilot budget requires review';
/** The open budget gates of a workflow: the supervisor-gates that hold every job for the budget. */
const budgetGatesOf = (db, workflowId) => supervisorGatesOf(db, workflowId).filter((gate) => gate.holds.includes('*') && gate.detail.startsWith(BUDGET_GATE_DETAIL));

const releaseBudgetGates = ({ ledger, db, workflowId, budget, now }) => {
  for (const gate of budgetGatesOf(db, workflowId)) {
    if (!resolveIncident(db, { incidentId: gate.incidentId, reason: 'fixed', at: now })) continue;
    const detail = `the budget no longer holds the workflow: every completed attempt is measured (${budget.coverage.measured} of ${budget.coverage.attempts} attempts) and no cap is exceeded`;
    ledger.appendEvent({ workflowId, entityType: 'incident', entityId: gate.incidentId, kind: 'incident-resolved',
      payload: { detail, by: AUTOPILOT_BY, evidence: budget } });
  }
};

/** One evaluation of the budget gate: open it when the budget holds the workflow, resolve it when it no longer does. */
export const gateExceededBudget = ({ ledger, db, workflowId, budget, now = Date.now() }) => {
  if (!(budget.exceeded.length || budget.unverified.length)) return releaseBudgetGates({ ledger, db, workflowId, budget, now });
  if (supervisorGatesOf(db, workflowId).some((g) => g.holds.includes('*'))) return;
  const exceeded = budget.exceeded.map((k) => `${k} ${k === 'tokens' ? budget.measured.tokens : budget.used[k]} > ${budget.caps[k]}`);
  const unverified = budget.unverified.map((k) => `${k} unknown: ${budget.coverage.unknown} completed attempts lack usage`);
  const detail = `${BUDGET_GATE_DETAIL} (${[...exceeded, ...unverified].join(', ')}): Supervisor review - record missing usage or extend with starci kernel autopilot --extend-budget, then resolve --by supervisor`;
  const incidentId = openSupervisorGate(ledger, { workflowId, holds: ['*'], detail, evidence: budget });
  ledger.appendEvent({ workflowId, entityType: 'incident', entityId: incidentId, kind: AUTOPILOT_EVENTS.budget, payload: { ...budget, incidentId, by: AUTOPILOT_BY } });
};
