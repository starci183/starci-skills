import type { AttemptDetailV2, EvidenceFile } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C9';

/** S5: one row per check with pass/fail colour, authority, exit codes, full command and a link to its output file. */
export function CheckList({ attempt, onOpenFile }: { attempt: AttemptDetailV2; onOpenFile: (file: EvidenceFile) => void }) {
  void attempt; void onOpenFile;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="S5">Check (S5)</div>;
}
