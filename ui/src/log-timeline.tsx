import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle, Bot, CheckCircle2, ChevronRight, CircleAlert, CircleDot, FileDiff, FlaskConical, GitCommitHorizontal, HelpCircle,
  ImageIcon, ListTree, MessageSquareText, Radio, Rocket, ScrollText, Send, SquareTerminal, X, XCircle,
} from 'lucide-react';
import type { LogPage, LogRow } from './types';
import { Markdown } from './markdown';

// The typed log of one or more jobs (scripts/kernel/typed-logs.mjs rows from /api/logs): step groups with their
// durations, command blocks with an exit badge, file edits that open the diff, check and test chips, render
// thumbnails, narration as markdown and errors as alerts. Live follow streams new rows (/api/logs/stream).

const en = () => document.documentElement.lang === 'en';
const t = (vi: string, english: string) => (en() ? english : vi);
const clock = (at: number) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Bangkok' }).format(at);
const duration = (ms: unknown) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1000) return `${Math.round(n)} ms`;
  if (n < 60_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)} s`;
  return `${Math.floor(n / 60_000)}m ${Math.round((n % 60_000) / 1000)}s`;
};
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const merge = (old: LogRow[], fresh: LogRow[]) => [...new Map([...old, ...fresh].map((row) => [row.seq, row])).values()].sort((a, b) => a.at - b.at || a.seq - b.seq);
const actorTone: Record<string, string> = {
  kernel: 'border-violet-500/30 text-violet-400', op: 'border-sky-500/30 text-sky-400', runtime: 'border-zinc-700 text-zinc-500',
  check: 'border-amber-500/30 text-amber-400', land: 'border-emerald-500/30 text-emerald-400',
};

type Node = { row: LogRow; children?: Node[]; end?: LogRow | null };
/** step.start opens a group closed by the step.end of the same name (nested groups allowed); an unclosed group stays open. */
export function groupRows(rows: LogRow[]): Node[] {
  const root: Node[] = [];
  const stack: Node[] = [];
  for (const row of rows) {
    const holder = stack.length ? stack[stack.length - 1].children! : root;
    if (row.kind === 'step.start') { const node: Node = { row, children: [], end: null }; holder.push(node); stack.push(node); continue; }
    if (row.kind === 'step.end') {
      const at = [...stack].reverse().findIndex((n) => str(n.row.data.name) === str(row.data.name));
      if (at >= 0) { const index = stack.length - 1 - at; stack[index].end = row; stack.length = index; continue; }
    }
    holder.push({ row });
  }
  return root;
}

function Badge({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium ${tone}`}>{children}</span>;
}
const toneOf = (ok: boolean | null) => (ok === null ? 'border-zinc-700 text-zinc-400' : ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400');

function Lightbox({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose]);
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={onClose} role="dialog" aria-label={label}>
    <button type="button" className="absolute right-4 top-4 rounded-md bg-zinc-900 p-1.5 text-zinc-300" aria-label={t('Đóng', 'Close')}><X className="size-4" /></button>
    <figure className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}><img src={src} alt={label} className="max-h-[85vh] max-w-full rounded-md bg-zinc-900 object-contain" /><figcaption className="mt-2 text-center font-mono text-[11px] text-zinc-300">{label}</figcaption></figure>
  </div>;
}

interface RowProps { row: LogRow; resolveRef: (ref: string) => string | null; onOpenFile?: (path: string) => void }

function RowBody({ row, resolveRef, onOpenFile }: RowProps) {
  const d = row.data;
  const [zoom, setZoom] = useState(false);
  const [broken, setBroken] = useState(false);
  switch (row.kind) {
    case 'cmd.run': {
      const exit = num(d.exit);
      const output = str(d.output);
      const refs = [str(d.stdoutRef), str(d.stderrRef)].filter(Boolean);
      return <details className="group rounded-md border border-zinc-800 bg-zinc-950" data-testid="log-cmd">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5">
          <SquareTerminal className="size-3.5 shrink-0 text-zinc-500" />
          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-200" title={str(d.cmd)}>$ {str(d.cmd)}</code>
          {duration(d.durationMs) && <span className="shrink-0 text-[10px] text-zinc-500">{duration(d.durationMs)}</span>}
          <Badge tone={toneOf(exit === 0)}>exit {exit ?? '?'}</Badge>
          {(output || refs.length > 0) && <ChevronRight className="size-3 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" />}
        </summary>
        {(output || refs.length > 0) && <div className="border-t border-zinc-800 p-2">
          {output && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[10.5px] leading-4 text-zinc-400">{output}</pre>}
          {refs.map((ref) => { const url = resolveRef(ref); return <div key={ref} className="mt-1 break-all font-mono text-[10px] text-zinc-500">{url ? <a href={url} target="_blank" rel="noreferrer" className="text-sky-400 underline">{ref}</a> : ref}</div>; })}
        </div>}
      </details>;
    }
    case 'file.edit': {
      const added = num(d.added), removed = num(d.removed);
      return <button type="button" disabled={!onOpenFile} onClick={() => onOpenFile?.(str(d.path))} className="flex w-full min-w-0 items-center gap-2 rounded-md border border-zinc-800 px-2 py-1.5 text-left enabled:hover:border-sky-500/50 enabled:hover:bg-sky-500/5" data-testid="log-file-edit" title={t('Mở diff của tệp', 'Open the file diff')}>
        <FileDiff className="size-3.5 shrink-0 text-sky-400" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-200">{str(d.path)}</span>
        {added != null && <span className="font-mono text-[11px] text-emerald-400">+{added}</span>}
        {removed != null && <span className="font-mono text-[11px] text-red-400">−{removed}</span>}
      </button>;
    }
    case 'check.result': {
      const pass = d.pass === true;
      const detail = [str(d.command), str(d.evidence)].filter(Boolean);
      return <details className="group" data-testid="log-check"><summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
        <Badge tone={toneOf(pass)}>{pass ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}{str(d.name)}</Badge>
        {detail.length > 0 && <ChevronRight className="size-3 text-zinc-500 transition-transform group-open:rotate-90" />}
      </summary>{detail.length > 0 && <div className="mt-1 space-y-1 rounded-md border border-zinc-800 p-2 text-[11px]">{str(d.command) && <code className="block break-all font-mono text-zinc-400">$ {str(d.command)}</code>}{str(d.evidence) && <p className="break-words text-zinc-400">{str(d.evidence)}</p>}</div>}</details>;
    }
    case 'test.result': {
      const failed = num(d.failed) ?? 0, passed = num(d.passed) ?? 0, skipped = num(d.skipped);
      const failures = Array.isArray(d.failures) ? d.failures as { name?: string; message?: string; file?: string }[] : [];
      return <div className="space-y-1.5" data-testid="log-test">
        <div className="flex flex-wrap items-center gap-2"><FlaskConical className="size-3.5 text-zinc-500" /><span className="font-mono text-[11px] text-zinc-200">{str(d.suite)}</span>
          <Badge tone={toneOf(true)}>{passed} {t('đạt', 'passed')}</Badge>{failed > 0 && <Badge tone={toneOf(false)}>{failed} {t('trượt', 'failed')}</Badge>}{skipped ? <Badge tone={toneOf(null)}>{skipped} {t('bỏ qua', 'skipped')}</Badge> : null}
          {duration(d.durationMs) && <span className="text-[10px] text-zinc-500">{duration(d.durationMs)}</span>}</div>
        {failures.length > 0 && <div className="overflow-x-auto rounded-md border border-red-500/20"><table className="w-full text-left text-[11px]"><thead className="text-zinc-500"><tr><th className="px-2 py-1 font-medium">{t('Ca kiểm thử', 'Test')}</th><th className="px-2 py-1 font-medium">{t('Lỗi', 'Failure')}</th></tr></thead>
          <tbody>{failures.slice(0, 50).map((f, i) => <tr key={i} className="border-t border-zinc-800 align-top"><td className="px-2 py-1 font-mono text-zinc-200">{str(f.name)}{f.file && <div className="text-[10px] text-zinc-500">{str(f.file)}</div>}</td><td className="whitespace-pre-wrap break-words px-2 py-1 text-red-300">{str(f.message)}</td></tr>)}</tbody></table></div>}
      </div>;
    }
    case 'render': {
      const ref = str(d.artifactRef), url = resolveRef(ref), label = str(d.label) || ref.split('/').pop() || ref;
      return <div className="flex items-center gap-2" data-testid="log-render">
        {url && !broken ? <button type="button" onClick={() => setZoom(true)} className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 hover:border-sky-500/50" title={t('Phóng to', 'Zoom')}><img src={url} alt={label} loading="lazy" onError={() => setBroken(true)} className="h-16 w-28 object-contain" /></button>
          : <span className="flex h-16 w-28 items-center justify-center rounded-md border border-dashed border-zinc-700 text-zinc-600"><ImageIcon className="size-4" /></span>}
        <div className="min-w-0"><div className="truncate font-mono text-[11px] text-violet-400">{label}</div><div className="truncate font-mono text-[10px] text-zinc-500" title={ref}>{ref}</div></div>
        {zoom && url && !broken && <Lightbox src={url} label={label} onClose={() => setZoom(false)} />}
      </div>;
    }
    case 'decision':
    case 'narration':
      return <Markdown text={str(d.markdown)} />;
    case 'ask': {
      const options = Array.isArray(d.options) ? d.options.map(str) : [];
      return <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-2 text-xs"><p className="text-zinc-200">{str(d.question)}</p>{options.length > 0 && <ol className="mt-1 list-decimal pl-5 text-zinc-400">{options.map((o, i) => <li key={i}>{o}</li>)}</ol>}</div>;
    }
    case 'error':
      return <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs" role="alert" data-testid="log-error">
        <div className="flex flex-wrap items-center gap-2"><CircleAlert className="size-3.5 text-red-400" /><code className="rounded bg-red-500/15 px-1.5 py-px font-mono text-[10.5px] text-red-300">{str(d.code)}</code></div>
        <p className="mt-1 whitespace-pre-wrap break-words text-red-300">{str(d.message)}</p>
        {str(d.hint) && <p className="mt-1 text-[11px] text-zinc-400">{str(d.hint)}</p>}
      </div>;
    case 'settle': {
      const verdict = str(d.verdict);
      return <div className="flex flex-wrap items-center gap-2"><Badge tone={toneOf(verdict === 'pass' ? true : verdict ? false : null)}>verdict {verdict}</Badge>
        {num(d.observed) != null && <span className="text-[11px] text-zinc-500">{num(d.passed) ?? 0}/{num(d.observed)} check</span>}</div>;
    }
    case 'land':
      return <div className="flex flex-wrap items-center gap-2"><Badge tone={toneOf(true)}><GitCommitHorizontal className="size-3" />{str(d.head).slice(0, 10)}</Badge>{str(d.repo) && <span className="font-mono text-[10px] text-zinc-500">{str(d.repo).split(/[\\/]/).pop()}</span>}</div>;
    case 'incident':
      return <p className="whitespace-pre-wrap break-words text-[11px] text-zinc-400"><code className="mr-1 font-mono text-amber-400">{str(d.id)}</code>{str(d.detail)}</p>;
    default:
      return null;
  }
}

const KIND_ICON: Partial<Record<LogRow['kind'], ReactNode>> = {
  dispatch: <Send className="size-3.5 text-sky-400" />, report: <ScrollText className="size-3.5 text-zinc-400" />, settle: <CheckCircle2 className="size-3.5 text-emerald-400" />,
  land: <Rocket className="size-3.5 text-emerald-400" />, incident: <AlertTriangle className="size-3.5 text-amber-400" />, 'job.drop': <XCircle className="size-3.5 text-zinc-500" />,
  decision: <Bot className="size-3.5 text-violet-400" />, narration: <MessageSquareText className="size-3.5 text-zinc-400" />, ask: <HelpCircle className="size-3.5 text-sky-400" />,
  error: <CircleAlert className="size-3.5 text-red-400" />, render: <ImageIcon className="size-3.5 text-violet-400" />, 'test.result': <FlaskConical className="size-3.5 text-zinc-400" />, 'log.truncated': <AlertTriangle className="size-3.5 text-amber-400" />,
};
// Rows whose body already says everything their msg says: only the body is shown.
const BODY_ONLY = new Set(['cmd.run', 'file.edit', 'check.result', 'test.result', 'render']);

function RowLine(props: RowProps) {
  const { row } = props;
  const body = <RowBody {...props} />;
  const levelTone = row.level === 'error' ? 'text-red-300' : row.level === 'warn' ? 'text-amber-300' : 'text-zinc-300';
  return <li className="grid grid-cols-[3.9rem_1fr] gap-2 py-1" data-kind={row.kind} data-testid="log-row">
    <span className="pt-0.5 font-mono text-[10px] tabular-nums text-zinc-600" title={new Date(row.at).toISOString()}>{clock(row.at)}</span>
    <div className="min-w-0 space-y-1">
      {!BODY_ONLY.has(row.kind) && <div className="flex min-w-0 items-start gap-1.5">
        <span className="mt-0.5 shrink-0">{KIND_ICON[row.kind] ?? <CircleDot className="size-3.5 text-zinc-600" />}</span>
        <span className={`min-w-0 flex-1 break-words text-xs ${levelTone}`}>{row.msg}</span>
        {row.actor !== 'op' && <Badge tone={actorTone[row.actor] ?? actorTone.runtime}>{row.actor}</Badge>}
      </div>}
      {body}
    </div>
  </li>;
}

function Group({ node, ...props }: { node: Node } & Omit<RowProps, 'row'>) {
  const children = node.children ?? [];
  const flat = (nodes: Node[]): LogRow[] => nodes.flatMap((n) => [n.row, ...(n.end ? [n.end] : []), ...flat(n.children ?? [])]);
  const inside = flat(children);
  const errors = inside.filter((r) => r.level === 'error').length;
  const ended = node.end ?? null;
  const ms = ended ? (num(ended.data.durationMs) ?? ended.at - node.row.at) : null;
  const failed = ended?.data.ok === false || errors > 0;
  return <li className="py-1" data-testid="log-step">
    <details open={!ended || failed} className="group rounded-lg border border-zinc-800 bg-zinc-900/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5">
        <ChevronRight className="size-3.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" />
        <ListTree className="size-3.5 shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">{str(node.row.data.name) || node.row.msg}</span>
        {errors > 0 && <Badge tone={toneOf(false)}>{errors} {t('lỗi', 'error')}</Badge>}
        <span className="shrink-0 text-[10px] text-zinc-500">{children.length} {t('mục', 'rows')}</span>
        {ended ? <Badge tone={toneOf(!failed)}>{duration(ms) ?? '✓'}</Badge> : <Badge tone="border-yellow-400/30 text-yellow-300"><span className="agent-live-dot !size-1.5" />{t('đang chạy', 'running')}</Badge>}
      </summary>
      <ol className="border-t border-zinc-800 px-2.5 py-1">{children.map((child) => child.children ? <Group key={child.row.seq} node={child} {...props} /> : <RowLine key={child.row.seq} row={child.row} {...props} />)}</ol>
    </details>
  </li>;
}

const FILTERS = [
  ['all', 'Tất cả', 'All'], ['problems', 'Lỗi & cảnh báo', 'Problems'], ['commands', 'Lệnh', 'Commands'], ['files', 'Tệp', 'Files'], ['checks', 'Kiểm tra', 'Checks'],
] as const;
type Filter = typeof FILTERS[number][0];
const keep = (filter: Filter, row: LogRow) => filter === 'all' || row.kind === 'step.start' || row.kind === 'step.end'
  || (filter === 'problems' && row.level !== 'info') || (filter === 'commands' && row.kind === 'cmd.run')
  || (filter === 'files' && (row.kind === 'file.edit' || row.kind === 'render')) || (filter === 'checks' && (row.kind === 'check.result' || row.kind === 'test.result'));

/** The typed timeline of `jobIds` in `workflowId`. `resolveRef` turns an artifact path into a URL; `onOpenFile` opens the diff. */
export function LogTimeline({ projectId, workflowId, jobIds, resolveRef = () => null, onOpenFile, live = false }: {
  projectId: string; workflowId: string; jobIds: string[]; resolveRef?: (ref: string) => string | null; onOpenFile?: (path: string) => void; live?: boolean;
}) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [follow, setFollow] = useState(live);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const cursor = useRef(0);
  const list = useRef<HTMLDivElement | null>(null);
  const key = jobIds.join(',');
  useEffect(() => {
    const controller = new AbortController();
    setRows([]); setState('loading'); cursor.current = 0;
    const params = new URLSearchParams({ project: projectId, workflow: workflowId, job: key });
    fetch(`/api/logs?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<LogPage>; })
      .then((page) => { setRows(merge([], page.rows)); cursor.current = page.cursor; setState('ready'); })
      .catch((cause) => { if (!controller.signal.aborted) { setError(String(cause)); setState('error'); } });
    return () => controller.abort();
  }, [projectId, workflowId, key]);
  useEffect(() => {
    if (!follow || state !== 'ready') { setConnected(false); return; }
    const params = new URLSearchParams({ project: projectId, workflow: workflowId, job: key, after: String(cursor.current) });
    const source = new EventSource(`/api/logs/stream?${params}`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      try { const row = JSON.parse(message.data) as LogRow; cursor.current = Math.max(cursor.current, row.seq); setRows((current) => merge(current, [row])); }
      catch { /* a malformed frame changes no row */ }
    };
    return () => source.close();
  }, [follow, state, projectId, workflowId, key]);
  useEffect(() => { if (follow && list.current) list.current.scrollTop = list.current.scrollHeight; }, [rows, follow]);
  const shown = useMemo(() => rows.filter((row) => keep(filter, row)), [rows, filter]);
  const tree = useMemo(() => groupRows(shown), [shown]);
  const problems = rows.filter((row) => row.level === 'error').length;
  return <section className="rounded-lg border border-zinc-800 bg-zinc-950/70" data-testid="log-timeline">
    <header className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
      <ScrollText className="size-3.5 text-sky-400" />
      <strong className="text-xs text-zinc-200">{t('Nhật ký có cấu trúc', 'Typed log')}</strong>
      <span className="text-[11px] text-zinc-500">{rows.length} {t('dòng', 'rows')}{problems ? ` · ${problems} ${t('lỗi', 'errors')}` : ''}</span>
      <button type="button" onClick={() => setFollow((v) => !v)} aria-pressed={follow} className={`ml-auto inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${follow ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`} data-testid="log-follow">
        <Radio className="size-3" />{follow ? (connected ? t('Đang theo dõi', 'Following') : t('Đang nối...', 'Connecting...')) : t('Theo dõi trực tiếp', 'Live follow')}
      </button>
    </header>
    <div className="flex flex-wrap gap-1 border-b border-zinc-800 px-3 py-1.5">{FILTERS.map(([id, vi, english]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-md px-2 py-0.5 text-[11px] ${filter === id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>{en() ? english : vi}</button>)}</div>
    <div ref={list} className="max-h-[60vh] overflow-y-auto px-3 py-1.5">
      {state === 'loading' ? <p className="py-2 text-xs text-zinc-500">{t('Đang đọc nhật ký...', 'Reading the log...')}</p>
        : state === 'error' ? <p className="py-2 text-xs text-red-400">{t('Không đọc được nhật ký', 'Could not read the log')}: {error}</p>
          : !tree.length ? <p className="py-2 text-xs text-zinc-500">{t('Job này chưa có dòng nhật ký nào.', 'This job has no log rows yet.')}</p>
            : <ol>{tree.map((node) => node.children ? <Group key={node.row.seq} node={node} resolveRef={resolveRef} onOpenFile={onOpenFile} /> : <RowLine key={node.row.seq} row={node.row} resolveRef={resolveRef} onOpenFile={onOpenFile} />)}</ol>}
    </div>
  </section>;
}
