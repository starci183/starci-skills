// Shared-foundation declaration gate for a workflow with running peers.
import { getWorkflow, workflowRunning } from './rows.mjs';
import { peerWorkflowsOf } from './peer-waits.mjs';
import { FOUNDATION_CHANGE_ID, declarationsOf, readFoundations } from '../../foundation-registry.mjs';
import { changeById, loadContractChanges } from '../../../machine/contract-version.mjs';

const foundationBriefOf = (db, foundation) => ({
  name: foundation.name, kind: foundation.kind, state: foundation.state, version: foundation.version ?? null,
  owner: foundation.owner?.workflowId ?? null, ownerRunning: foundation.owner ? workflowRunning(getWorkflow(db, foundation.owner.workflowId)) : false,
});
/**
 * A workflow's foundation duty. With running peers it declares what it owns and needs (or none)
 * before its first leg. The declaration is REQUIRED of a workflow created after the
 * shared-foundation-planning contract change; an older, already-running one is advised, never held
 * (the versioned-contract rule, modules/kernel/contract-changes/).
 */
export const foundationDutyFor = (db, wf, skillRoot, { foundations = readFoundations(db), registry = loadContractChanges(skillRoot) } = {}) => {
  const peers = peerWorkflowsOf(db, wf).map((peer) => peer.workflow_id);
  const declared = declarationsOf(db, wf.workflow_id, foundations);
  const change = changeById(registry, FOUNDATION_CHANGE_ID);
  const owed = peers.length > 0 && !declared.declared;
  // Enforced once the ledger plans foundations at all (a foundation or a declaration is recorded):
  // a ledger whose workflows never registered one is advised, so no workflow is held by a registry
  // nobody started.
  const ledgerPlans = foundations.length > 0 || Boolean(db.prepare("SELECT 1 FROM signals WHERE scope='foundation-declared' LIMIT 1").get());
  const required = owed && ledgerPlans && (!change || wf.created_at >= change.effectiveAt);
  return {
    peers, declared: declared.declared, none: declared.none,
    owns: declared.owns.map((f) => foundationBriefOf(db, f)), needs: declared.needs.map((f) => foundationBriefOf(db, f)),
    required, advised: owed && !required,
    ...(owed ? { detail: `${peers.length} running peer(s) share this ledger's source (${peers.join(', ')}) and this workflow declared no shared foundation: run api foundations, then api foundation --claim <name> for each it owns, --declare-dependent <name> for each it needs, or --declare-none${required ? '; api enqueue refuses its legs until it does' : ' (advised: it started before foundation planning, so nothing is held)'}` } : {}),
  };
};
