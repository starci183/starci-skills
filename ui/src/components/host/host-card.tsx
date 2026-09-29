import type { Concept } from '../concept';

export const concept: Concept = 'C14';

/** Slice C: host machine card (CPU, RAM, GPU, temperatures, disks, agents' RAM, sparkline) from /api/host. */
export function HostCard({ compact = false }: { compact?: boolean }) {
  void compact;
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-stub="C">Máy chủ (C)</div>;
}
