// scripts/reconciler/supervisor-mirror.mjs — the Supervisor reads machine.sqlite only (scripts/supervisor/supervisor-menu-sources.mjs), so a Decision Item
// opened in a product ledger with decider supervisor is owned by nobody: `starci supervisor status` lists none of it. The Kernel's menu-escape (a
// none-fits on an item that has no Decision Item of its own) is opened that way by `starci kernel decide`, which has no handle on the machine store.
// The Workflow controller therefore opens the Supervisor's twin of each such item, keyed `escalated:<ledger>:<id>` like the SLA ladder's escalation
// (scripts/machine/decisions.mjs escalateOne), the key the Supervisor's menu routes to kernel-escape (modules/supervisor/supervisor-menu.yaml).
import { listDecisions } from '../machine/decisions.mjs';

/** The kinds a Kernel verb opens in a product ledger for the Supervisor. */
export const MIRRORED_KINDS = new Set(['menu-escape']);
export const SUPERVISOR_LEDGER_NAME = 'supervisor';

/**
 * The Supervisor-ledger specs of one workflow's live product-ledger items that the Supervisor decides: [{kind, ledger: 'supervisor', idempotencyKey, ...}].
 * `db` is a ledger handle, `ledgerName` the name the machine registry resolves (the repository folder), `ledgerId` its id. Pure over the rows.
 */
export const strandedSupervisorDis = (db, { ledgerId, ledgerName, workflowId, now }) => listDecisions(db, { workflowId, decider: 'supervisor', now })
  .filter((di) => MIRRORED_KINDS.has(di.kind) && ['open', 'claimed'].includes(di.status))
  .map((di) => ({
    schema: 'starci/decision-item@1', kind: di.kind, decider: 'supervisor', ledger: SUPERVISOR_LEDGER_NAME, idempotencyKey: `escalated:${ledgerName}:${di.id}`,
    workflowId, productLedger: ledgerName, entity: di.entity, summary: `Kernel DI ${di.id} (${di.kind}) in ${workflowId}: ${di.summary}`,
    evidence: [{ ref: `decision:${ledgerName}/${workflowId}/${di.id}` }, ...(di.evidence ?? []).slice(0, 10)], options: di.options ?? [], allowedVerbs: di.allowedVerbs ?? [],
    refs: { ledgerId, workflowId, decision: di.id }, openedBy: 'reconciler/mirror', item: `di|${ledgerName}|${di.id}`, ...(di.severity ? { severity: di.severity } : {}),
  }));
