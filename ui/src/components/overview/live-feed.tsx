import { useEffect, useRef, useState } from 'react';
import { Chip, Link } from '@heroui/react';
import { refreshQuery, useApiQuery } from '../../api/query';
import type { LogRow } from '../../contract';
import { statusTone, type Status } from '../status';
import { TimeAgo } from '../time-ago';
import type { Concept } from '../concept';
import { AgentAvatar, agentOf } from '../agent/agent-avatar';
import { useAttemptAgents } from '../agent/use-running-agents';
import { FeedbackState, SourceWarning } from '../feedback-state';
import { hasUnavailableSources } from './read-state';
import { t } from '../../i18n/t';

/** Names the C7 live feed concept this module belongs to, for the live event feed. */
export const concept: Concept = 'C7';

const levelStatus: Record<LogRow['level'], Status> = { debug: 'queued', info: 'running', warn: 'retry', error: 'failed' };
const LEVEL_COLOR = { debug: 'default', info: 'default', warn: 'warning', error: 'danger' } as const satisfies Record<LogRow['level'], string>;

type FeedBodyProps = Readonly<{ row: LogRow }>;
type FeedRowProps = Readonly<{ row: LogRow; fresh: boolean }>;
type LiveFeedProps = Readonly<{ limit?: number }>;
type EmptyLogs = Readonly<{ error?: string | null; data?: LogRow[] | null; meta?: unknown }>;

/** Where an event row should link: its attempt, else its workflow, else the first reference it carries; null when it names none. */
export const logHref = (row: LogRow): string | null => {
  const ref = row.refs.find(item => item.kind === 'attempt') ?? row.refs.find(item => item.kind === 'workflow') ?? row.refs[0];
  if (ref?.href) return ref.href;
  if (row.project && row.wf) return `#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.wf)}`;
  return null;
};

const FeedBody = ({ row }: FeedBodyProps) => {
  const source = row.store === 'machine' ? t('Machine') : row.ledgerId ?? row.db;
  return <span className="min-w-0 flex-1">
    <span className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><TimeAgo at={row.at} /><Chip size="sm" variant="soft" color={LEVEL_COLOR[row.level]}><Chip.Label>{row.level}</Chip.Label></Chip></span>
    <span className="block whitespace-pre-wrap break-words text-sm leading-relaxed">{row.msg}</span>
    <span className="mt-1 block break-words text-xs text-muted-foreground" title={[row.store, row.ledgerId, row.project, row.wf, row.job, row.actor].filter(Boolean).join(' · ')}>{[row.project, row.wf, row.job, row.actor].filter(Boolean).join(' · ')}</span>
    <span className="mt-1 block break-words text-xs text-muted-foreground">{t('Source')} · {source}</span>
  </span>;
};

const useFlashWhenFresh = (fresh: boolean) => {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (fresh && ref.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current.animate([{ backgroundColor: 'var(--default)' }, { backgroundColor: 'transparent' }], { duration: 240, easing: 'ease-out' });
    }
  }, [fresh]);
  return ref;
};

const FeedRow = ({ row, fresh }: FeedRowProps) => {
  const { forAttempt } = useAttemptAgents();
  const attemptRef = row.refs.find(item => item.kind === 'attempt');
  const attempt = row.actor === 'op' && attemptRef ? forAttempt(attemptRef.project ?? row.project, attemptRef.id) : undefined;
  const ref = useFlashWhenFresh(fresh);
  const href = logHref(row);
  const body = <FeedBody row={row} />;
  return <article ref={ref} data-tone={statusTone[levelStatus[row.level]]} style={{ borderLeftColor: 'var(--tone-line)' }} className="flex items-start gap-2 border-b border-l-2 px-4 py-3 last:border-b-0">
    {attempt ? <AgentAvatar agent={agentOf(attempt)} size={20} /> : null}
    {href ? <Link href={href} className="flex min-w-0 flex-1 items-start gap-2 text-foreground">{body}</Link> : body}
  </article>;
};

type Tracked = { readonly data: LogRow[] | null | undefined; readonly seen: ReadonlySet<string> | null; readonly fresh: ReadonlySet<string> };
const noKeys: ReadonlySet<string> = new Set();

const emptyMessage = (logs: EmptyLogs, partial: boolean): string => {
  if (logs.error) return t('The source is unavailable.');
  if (logs.data == null) return logs.meta ? t('Event observations have not been recorded.') : t('Loading…');
  return partial ? t('No events were observed in the last read.') : t('No events yet.');
};

/** Live feed from /api/logs, newest first; rows that arrive after the first load flash once. */
export const LiveFeed = ({ limit = 30 }: LiveFeedProps) => {
  const url = `/api/logs?limit=${limit}`;
  const logs = useApiQuery<LogRow[]>(url, { topics: ['logs'], intervalMs: 15_000 });
  const [tracked, setTracked] = useState<Tracked>({ data: undefined, seen: null, fresh: noKeys });
  const rows = logs.data ?? [];
  const partial = hasUnavailableSources(logs.meta);
  if (logs.data !== tracked.data) {
    const previous = tracked.seen;
    setTracked({
      data: logs.data,
      seen: logs.data ? new Set(rows.map(row => row.key)) : previous,
      fresh: logs.data && previous ? new Set(rows.filter(row => !previous.has(row.key)).map(row => row.key)) : noKeys,
    });
  }
  const fresh = tracked.fresh;
  const retryProps = logs.error ? { onRetry: () => refreshQuery(url) } : {};
  const moreNote = logs.meta?.next ? ` · ${t('More events are available in Logs.')}` : '';
  return <div className="max-h-[32rem] overflow-y-auto">
    <p className="px-4 py-2 text-xs text-muted-foreground">{t('Latest {n} loaded events · host scope', { n: logs.data == null ? '—' : rows.length })}{moreNote}</p>
    {logs.error && rows.length > 0 && <SourceWarning className="m-3">{t('The source is failing; showing the last read. {error}', { error: logs.error })}</SourceWarning>}
    {partial ? <SourceWarning className="m-3">{t('Some sources are unavailable; showing the recorded part.')}</SourceWarning> : null}
    {rows.map(row => <FeedRow key={row.key} row={row} fresh={fresh.has(row.key)} />)}
    {!rows.length && <div className="px-4 py-3"><FeedbackState error={Boolean(logs.error)} {...retryProps}>{emptyMessage(logs, partial)}</FeedbackState></div>}
  </div>;
};
