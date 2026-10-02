import { useApiQuery } from '../../api/query';
import type { AttemptRow } from '../../contract';
import { agentOf, type LinkedAgent } from './agent-avatar';

export const attemptHref = (row: Pick<AttemptRow, 'project' | 'id'>) => `#/a/${encodeURIComponent(row.project)}/${row.id}`;
export const isRunningAttempt = (row: AttemptRow) => row.dispatchedAt != null && row.settledAt == null && row.endState == null;
export const attemptAgent = (row: AttemptRow, live = false): LinkedAgent => ({ ...agentOf(row), href: attemptHref(row), live });

/** Recent attempts from /api/attempts (shared cache); helpers to look up agents by job and list running ones. */
export function useAttemptAgents() {
  const query = useApiQuery<AttemptRow[]>('/api/attempts?limit=200', { topics: ['workers'], intervalMs: 30_000 });
  const rows = query.data ?? [];
  const byJob = new Map<string, AttemptRow>();
  for (const row of rows) { const key = `${row.project}/${row.job}`; const old = byJob.get(key); if (!old || row.id > old.id) byJob.set(key, row); }
  const running = rows.filter(isRunningAttempt);
  return { rows, running, byJob, forJob: (project: string | null, job: string | null) => (project && job ? byJob.get(`${project}/${job}`) : undefined) };
}
