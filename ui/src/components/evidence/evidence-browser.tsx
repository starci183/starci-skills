import type { EvidenceFile } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C8';

/** S6: grouped file tree + type-aware viewer for every attachment of an attempt. */
export function EvidenceBrowser({ files, selected, onSelect }: { files: EvidenceFile[]; selected: number | null; onSelect: (artifactId: number) => void }) {
  void files; void selected; void onSelect;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="S6">Bằng chứng (S6)</div>;
}
