// Shared-foundation declaration gate for a workflow with running peers.
import { getWorkflow, workflowRunning } from './rows.mjs';
import { peerWorkflowsOf } from './peer-waits.mjs';
import { declarationsOf, readFoundations } from '../../foundation-registry.mjs';

const foundationBriefOf = (db, foundation) => ({
  name: foundation.name, kind: foundation.kind, state: foundation.state, version: foundation.version ?? null,
  owner: foundation.owner?.workflowId ?? null, ownerRunning: foundation.owner ? workflowRunning(getWorkflow(db, foundation.owner.workflowId)) : false,
});
/** Running peers declare shared foundations before a leg when the ledger uses foundation planning. */
export const foundationDutyFor = (db, wf, skillRoot, { foundations = readFoundations(db) } = {}) => {
  const peers = peerWorkflowsOf(db, wf).map((peer) => peer.workflow_id);
  const declared = declarationsOf(db, wf.workflow_id, foundations);
  const owed = peers.length > 0 && !declared.declared;
  // Enforced once the ledger plans foundations at all (a foundation or a declaration is recorded):
  // a ledger whose workflows never registered one is advised, so no workflow is held by a registry
  // nobody started.
  const ledgerPlans = foundations.length > 0 || Boolean(db.prepare("SELECT 1 FROM signals WHERE scope='foundation-declared' LIMIT 1").get());
  const required = owed && ledgerPlans;
  return {
    peers, declared: declared.declared, none: declared.none,
    owns: declared.owns.map((f) => foundationBriefOf(db, f)), needs: declared.needs.map((f) => foundationBriefOf(db, f)),
    required, advised: owed && !required,
    ...(owed ? { detail: `${peers.length} running peer(s) share this ledger's source (${peers.join(', ')}) and this workflow declared no shared foundation: run starci kernel foundations, then starci kernel foundation --claim <name> for each it owns, --declare-dependent <name> for each it needs, or --declare-none${required ? '; starci kernel enqueue refuses its legs until it does' : ' (the ledger has no shared-foundation planning)'}` } : {}),
  };
};
