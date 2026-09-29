import type { LegRow, PipelineView } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C4';

/** S3: the whole planned op chain as a pipeline (columns = levels, stacked = parallel). */
export function PipelineGraph({ pipeline, selected, onSelect }: { pipeline: PipelineView; selected: string | null; onSelect: (leg: LegRow) => void }) {
  void pipeline; void selected; void onSelect;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="S3">Đồ thị chuỗi op (S3)</div>;
}
