import type { PipelineView } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C7';

/** S4: timeline of every attempt per leg (bar = dispatched → settled/now, colour = status). */
export function AttemptGantt({ pipeline, now }: { pipeline: PipelineView; now: number }) {
  void pipeline; void now;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="S4">Dòng thời gian lần thử (S4)</div>;
}
