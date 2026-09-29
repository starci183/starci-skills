import type { AttemptDetailV3 } from '../../../contract';
import type { Concept } from '../../concept';

export const concept: Concept = 'C10';

/** P3: block 4 "Kết luận" — op outcome + summary, manifest assertions, claims, kernel verdict and reason. */
export function ResultCard({ attempt }: { attempt: AttemptDetailV3 }) {
  void attempt;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="P3">Kết luận (P3)</div>;
}
