import { useEffect, useRef } from 'react';
import { useApiQuery } from '../../api/query';
import type { LogRow } from '../../contract';
import { statusTone, type Status } from '../status';
import { TimeAgo } from '../time-ago';
import type { Concept } from '../concept';
import { AgentAvatar } from '../agent/agent-avatar';
import { attemptAgent, useAttemptAgents } from '../agent/use-running-agents';
import { t } from '../../i18n/t';

export const concept: Concept = 'C7';

const levelStatus: Record<LogRow['level'], Status> = { debug: 'queued', info: 'running', warn: 'retry', error: 'failed' };

export function logHref(row: LogRow): string | null {
  const ref = row.refs.find(item => item.kind === 'attempt') ?? row.refs.find(item => item.kind === 'workflow') ?? row.refs[0];
  if (ref?.href) return ref.href;
  if (row.project && row.wf) return `#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.wf)}`;
  return null;
}

function FeedRow({ row, fresh }: { row: LogRow; fresh: boolean }) {
  const { forJob } = useAttemptAgents();
  const attempt = forJob(row.project, row.job);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (fresh && ref.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current.animate([{ backgroundColor: 'var(--muted)' }, { backgroundColor: 'transparent' }], { duration: 240, easing: 'ease-out' });
    }
  }, [fresh]);
  const href = logHref(row);
  const body = <>
    <span className="w-14 shrink-0 text-xs text-muted-foreground"><TimeAgo at={row.at} /></span>
    {attempt ? <AgentAvatar agent={attemptAgent(attempt)} size={20} /> : null}
    <span className="min-w-0 flex-1">
      <span className="line-clamp-2 break-words text-[13px]">{row.msg}</span>
      <span className="block truncate text-[11.5px] text-muted-foreground">{[row.project, row.wf, row.job, row.actor].filter(Boolean).join(' · ')}</span>
    </span>
  </>;
  return <article ref={ref} data-tone={statusTone[levelStatus[row.level]]} style={{ borderLeftColor: 'var(--tone-line)' }} className="flex gap-2 border-b border-l-2 px-4 py-2 last:border-b-0">
    {href ? <a href={href} className="flex min-w-0 flex-1 gap-2 hover:text-primary">{body}</a> : body}
  </article>;
}

/** Live feed from /api/logs, newest first; rows that arrive after the first load flash once. */
export function LiveFeed({ limit = 30 }: { limit?: number }) {
  const logs = useApiQuery<LogRow[]>(`/api/logs?limit=${limit}`, { topics: ['logs'], intervalMs: 15_000 });
  const seen = useRef<Set<string> | null>(null);
  const rows = logs.data ?? [];
  const fresh = new Set<string>();
  if (logs.data && seen.current) for (const row of rows) if (!seen.current.has(row.key)) fresh.add(row.key);
  useEffect(() => {
    if (logs.data) seen.current = new Set(logs.data.map(row => row.key));
  }, [logs.data]);
  return <div className="max-h-[32rem] overflow-y-auto">
    {rows.map(row => <FeedRow key={row.key} row={row} fresh={fresh.has(row.key)} />)}
    {!rows.length && <p className="px-4 py-3 text-sm text-muted-foreground">{logs.error ?? (logs.loading ? t('Loading…') : t('No events yet.'))}</p>}
  </div>;
}
