import type { AttemptDetailV2 } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C6';

/** S8: "Nơi chạy & tài nguyên" — every host location, id and resource the attempt touched. */
export function AttemptWhereCard({ attempt }: { attempt: AttemptDetailV2 }) {
  void attempt;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="S8">Nơi chạy & tài nguyên (S8)</div>;
}
