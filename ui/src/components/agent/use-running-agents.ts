import { useApiQuery } from '../../api/query';
import type { AttemptRow } from '../../contract';
import { agentOf, type LinkedAgent } from './agent-avatar';

export const attemptHref = (row: Pick<AttemptRow, 'project' | 'id'>) => `#/a/${encodeURIComponent(row.project)}/${row.id}`;
export const isRunningAttempt = (row: AttemptRow) => row.dispatchedAt != null && row.reportedAt == null && row.reportOutcome == null && row.settledAt == null && row.endState == null && row.terminalEndedAt == null;
export const isSettlingAttempt = (row: AttemptRow) => row.dispatchedAt != null && (row.reportedAt != null || row.reportOutcome != null) && row.settledAt == null && row.endState == null;
export const attemptAgent = (row: AttemptRow, live = false): LinkedAgent => ({ ...agentOf(row), href: attemptHref(row), live });

/** Bounded attempt pages. Execution and reported observations remain separate from agent availability. */
export function useAttemptAgents() {
  const query = useApiQuery<AttemptRow[]>('/api/attempts?limit=200', { topics: ['workers'], intervalMs: 30_000 });
  const active = useApiQuery<AttemptRow[]>('/api/attempts?active=1&limit=200', { topics: ['workers'], intervalMs: 30_000 });
  const indexed = new Map<string, AttemptRow>();
  for (const row of [...(query.data ?? []), ...(active.data ?? [])]) indexed.set(`${row.ledgerId ?? row.project}/${row.id}`, row);
  const rows = [...indexed.values()].sort((a, b) => (b.dispatchedAt ?? 0) - (a.dispatchedAt ?? 0) || b.id - a.id);
  const byAttempt = new Map<string, AttemptRow>();
  for (const row of rows) {
    byAttempt.set(`${row.project}/${row.id}`, row);
    if (row.ledgerId) byAttempt.set(`${row.ledgerId}/${row.id}`, row);
  }
  const byJob = new Map<string, AttemptRow>();
  for (const row of rows) { const key = `${row.project}/${row.job}`; const old = byJob.get(key); if (!old || row.id > old.id) byJob.set(key, row); }
  const running = (active.data ?? []).filter(isRunningAttempt);
  const settling = (active.data ?? []).filter(isSettlingAttempt);
  return { rows, running, settling, byJob, loading: active.loading, error: active.error, meta: active.meta,
    activeObserved: active.data != null, historyError: query.error, historyMeta: query.meta,
    forAttempt: (project: string | null | undefined, id: number | string) => project ? byAttempt.get(`${project}/${id}`) : undefined,
    forJob: (project: string | null, job: string | null) => (project && job ? byJob.get(`${project}/${job}`) : undefined) };
}
