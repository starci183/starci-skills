import type { AttemptDetailV2 } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C8';

/** S5: "Đầu vào" (what the op received) and "Đầu ra" (what it returned) side by side. */
export function AttemptIO({ attempt }: { attempt: AttemptDetailV2 }) {
  void attempt;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="S5">Đầu vào / Đầu ra (S5)</div>;
}
