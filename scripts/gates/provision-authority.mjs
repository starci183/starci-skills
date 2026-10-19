// Native caller binding is provided by the CLI owner; this lower tier never invents roles from flags.
import { provisionGoalGrant } from '../../engine/db/provision-authority.mjs';
import { openMachineReader } from '../../engine/db/machine.mjs';
import { canonicalPath, pathKey } from '../lib/path-key.mjs';

/** Resolve exact current goal authority or the unbound owner's existing terminal acceptance path. */
export function resolveProvisionAuthority(ctx, { ledger, target, operationId, planSha }) {
  let caller, machine;
  try {
    if (typeof ctx.provisionCaller !== 'function') return { ok: false, bound: true, reason: 'provision-native-caller-unverified' };
    caller = ctx.provisionCaller({ db: ledger.db, file: ledger.file, root: target.ledgerRoot });
    if (!caller.guard && !caller.seat && ctx.role === 'owner'
      && caller.classification?.role === 'owner' && caller.classification.via === 'unbound')
      return { ok: true, bound: false, kind: 'owner-terminal' };
    const guard = caller.guard;
    if (!guard?.workflowWorktree || !target.ledgerRoot || !target.repoRoot || caller.classification?.role !== 'op'
      || caller.classification.jobId !== guard.jobId || caller.classification.workflowId !== guard.workflowId)
      return { ok: false, bound: true, reason: 'provision-native-caller-unverified' };
    machine = openMachineReader({ env: ctx.env });
    const placement = machine?.worktreeRow(target.repoRoot);
    if (!placement || placement.removed_at !== null || placement.kind !== 'workflow'
      || placement.workflow_id !== guard.workflowId || placement.ledger_id !== ledger.ledgerId
      || pathKey(canonicalPath(placement.repo_root)) !== pathKey(canonicalPath(target.ledgerRoot)))
      return { ok: false, bound: true, reason: 'provision-native-placement-unverified' };
    const result = provisionGoalGrant(ledger.db, { caller, operationId, planSha, ledgerId: ledger.ledgerId,
      repoRoot: target.ledgerRoot, worktree: target.repoRoot });
    return { ...result, bound: true, caller };
  } catch { return { ok: false, bound: true, reason: 'provision-native-caller-unverified' }; }
  finally { machine?.close(); }
}
