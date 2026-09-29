import type { Usage, WorkflowWhere } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C15';

/** S8: where the workflow runs on the host (repos, work tree, ledger, blobs, seat, terminals, worktrees) and its token/cost usage. */
export function WorkflowInfraCard({ where, usage }: { where: WorkflowWhere; usage: Usage }) {
  void where; void usage;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="S8">Hạ tầng & chi phí (S8)</div>;
}
