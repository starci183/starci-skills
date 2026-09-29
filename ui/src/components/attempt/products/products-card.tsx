import type { AttemptDetailV3 } from '../../../contract';
import type { Concept } from '../../concept';

export const concept: Concept = 'C8';

/** P3: block 5 "Sản phẩm (đầu ra thật)" — repo files written at report head (+diff) and key evidence. */
export function ProductsCard({ project, attempt }: { project: string; attempt: AttemptDetailV3 }) {
  void project; void attempt;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="P3">Sản phẩm (P3)</div>;
}
