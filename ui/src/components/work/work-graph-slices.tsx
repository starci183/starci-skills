import type { WorkGraphView } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C4';

/** S4: the scope's work graph (slices + data edges) from work_graph_versions. */
export function WorkGraphSlices({ graph }: { graph: WorkGraphView | null }) {
  void graph;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="S4">Lát cắt công việc (S4)</div>;
}
