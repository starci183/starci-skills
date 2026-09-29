import type { LegRow, PipelineView } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C4';

/** S4: side drawer for one leg: needs/produces/edges, units, every attempt with outcome + verdict. */
export function LegDrawer({ project, wf, leg, pipeline, onClose }: { project: string; wf: string; leg: LegRow | null; pipeline: PipelineView; onClose: () => void }) {
  void project; void wf; void pipeline; void onClose;
  if (!leg) return null;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="S4">Chi tiết chặng (S4)</div>;
}
