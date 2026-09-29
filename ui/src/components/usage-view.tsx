import type { Usage } from '../contract';
import type { Concept } from './concept';

export const concept: Concept = 'C16';

/** S8: token / cost usage block; shows "chưa ghi nhận" honestly when llm_usage is empty. */
export function UsageView({ usage, compact = false }: { usage: Usage; compact?: boolean }) {
  void usage; void compact;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="S8">Token (S8)</div>;
}
