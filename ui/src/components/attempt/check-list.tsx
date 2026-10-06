import { useState } from 'react';
import { ChevronRight, Copy, TriangleAlert } from 'lucide-react';
import type { AttemptDetailV2, CheckPair, CheckRow, EvidenceFile } from '../../contract';
import type { Concept } from '../concept';
import { BlobText } from '../blob-text';
import { PathLink } from '../path-link';
import { StatusChip } from '../status-chip';
import { Card, Empty } from './frame/card';
import { formatSpan } from './frame/util';
import { t } from '../../i18n/t';
import { runtimeObservation, verificationSummary } from './verification';

export const concept: Concept = 'C9';

const evidenceText = (summary: unknown): string | null => {
  if (typeof summary === 'string') return summary || null;
  if (summary && typeof summary === 'object') {
    const record = summary as Record<string, unknown>;
    if (typeof record.evidence === 'string') return record.evidence;
    if (typeof record.summary === 'string') return record.summary;
    return JSON.stringify(summary);
  }
  return null;
};

function CopyButton({ value }: Readonly<{ value: string }>) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground" title={t('Copy the command')} onClick={() => {
    void navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }, () => undefined);
  }}><Copy className="size-3" aria-hidden="true" />{copied ? t('Copied') : t('Copy')}</button>;
}

function matchFile(files: EvidenceFile[], check: CheckRow): EvidenceFile | null {
  return files.find(file => file.check?.id === check.id)
    ?? files.find(file => [check.output?.sha, check.stdout?.sha, check.stderr?.sha].includes(file.sha))
    ?? null;
}

type Verdict = 'pass' | 'fail' | null;
const verdictOf = (status: CheckRow['status'] | undefined, exit: number | null | undefined): Verdict => {
  if (status === 'pass') return 'pass';
  if (status === 'fail' || status === 'error') return 'fail';
  if (exit != null) return exit === 0 ? 'pass' : 'fail';
  return null;
};

function opSide(pair: CheckPair): { verdict: Verdict; exit: number | null } {
  if (pair.op) {
    const exit = pair.op.declaredExitCode ?? pair.op.exitCode;
    return { verdict: verdictOf(pair.op.status, exit), exit };
  }
  const declared = pair.runtime?.declaredExitCode ?? null;
  return { verdict: declared == null ? null : declared === 0 ? 'pass' : 'fail', exit: declared };
}
function runtimeSide(pair: CheckPair): { verdict: Verdict; exit: number | null } {
  const row = pair.runtime;
  if (!row) return { verdict: null, exit: null };
  const observation = runtimeObservation(row);
  return { verdict: observation === 'pass' || observation === 'fail' ? observation : null, exit: row.exitCode };
}

function Mark({ verdict, exit, extra }: Readonly<{ verdict: Verdict; exit: number | null; extra?: string | null }>) {
  const tone = verdict === 'pass' ? 'success' : verdict === 'fail' ? 'failed' : 'queued';
  return <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs" data-tone={tone} style={{ color: 'var(--tone)' }}>
    <b className="text-sm">{verdict === 'pass' ? '✓' : verdict === 'fail' ? '✗' : '—'}</b>
    {exit != null ? <span className="font-mono">exit {exit}</span> : null}
    {extra ? <span className="text-muted-foreground">· {extra}</span> : null}
  </span>;
}

function Tails({ check }: Readonly<{ check: CheckRow }>) {
  const tails = [check.stdout && ['stdout', check.stdout] as const, check.stderr && ['stderr', check.stderr] as const, check.output && ['output', check.output] as const].filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!tails.length) return null;
  return <details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">{t('Tail {labels}', { labels: tails.map(([label]) => label).join(' / ') })}</summary>
    <div className="mt-2 grid gap-2">{tails.map(([label, blob]) => <div key={label}><p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label} · {blob.bytes.toLocaleString('vi-VN')} B</p><div className="max-h-56 overflow-auto"><BlobText blob={blob} mode="tail" lines={40} /></div></div>)}</div></details>;
}

function PairRow({ pair, files, onOpenFile }: Readonly<{ pair: CheckPair; files: EvidenceFile[]; onOpenFile: (file: EvidenceFile) => void }>) {
  const [open, setOpen] = useState(false);
  const op = opSide(pair);
  const rt = runtimeSide(pair);
  const mismatch = (op.verdict != null && rt.verdict != null && op.verdict !== rt.verdict)
    || (op.exit != null && rt.exit != null && op.exit !== rt.exit);
  const main = pair.runtime ?? pair.op;
  const rows = [pair.runtime, pair.op].filter((row): row is CheckRow => Boolean(row));
  const evidence = rows.map(row => evidenceText(row.summary) ?? row.note).find(Boolean) ?? null;
  const command = main?.command ?? rows.find(row => row.command)?.command ?? null;
  const cwd = main?.cwd ?? rows.find(row => row.cwd)?.cwd ?? null;
  const file = rows.map(row => matchFile(files, row)).find(Boolean) ?? null;
  const tone = rt.verdict === 'fail' ? 'failed' : mismatch ? 'warning' : rt.verdict === 'pass' ? 'success' : 'queued';
  return <li className="min-w-0" data-tone={tone}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-1 py-2 text-left hover:bg-muted/40 sm:grid-cols-[auto_minmax(0,1fr)_9rem_13rem_auto]">
      <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
      <span className="min-w-0"><strong className="block break-words text-sm">{pair.name}</strong><span className="block break-words text-[11px] text-muted-foreground">{pair.runner} · {pair.authority} · {pair.phase}</span></span>
      <span className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-1 sm:col-auto sm:contents">
        <span className="inline-flex items-center gap-1"><span className="text-[11px] text-muted-foreground sm:hidden">{t('Op declared')}</span><Mark verdict={op.verdict} exit={op.exit} /></span>
        <span className="inline-flex flex-wrap items-center gap-1"><span className="text-[11px] text-muted-foreground sm:hidden">{t('Runtime ran')}</span><Mark verdict={rt.verdict} exit={rt.verdict == null ? null : rt.exit} extra={pair.runtime?.wallMs != null ? formatSpan(pair.runtime.wallMs) : null} />{rt.verdict == null ? <span className="text-[11px] text-muted-foreground">{pair.runtime?.status === 'unavailable' ? t('Unavailable') : pair.runtime?.status === 'skipped' ? t('Skipped') : t('Not confirmed')}</span> : null}</span>
        {mismatch ? <span className="inline-flex items-center gap-1 text-[11px] font-medium" data-tone="warning" style={{ color: 'var(--tone)' }} title={t('Op-declared and runtime-run do not match')}><TriangleAlert className="size-3.5" aria-hidden="true" />{t('Mismatch')}</span> : <span className="hidden sm:block" />}
      </span>
    </button>
    {open ? <div className="mb-2 ml-8 min-w-0 space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
      {evidence ? <p className="break-words">{evidence}</p> : null}
      {mismatch ? <p className="text-xs" data-tone="warning" style={{ color: 'var(--tone)' }}>{t('Mismatch: op declared {opExit}, runtime ran {runtimeExit}.', { opExit: op.exit ?? '—', runtimeExit: rt.exit ?? '—' })}</p> : null}
      {command ? <div className="flex min-w-0 items-start gap-2 rounded-md border bg-card p-2"><code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs">{command}</code><CopyButton value={command} /></div> : <p className="text-xs text-muted-foreground">{t('No command recorded.')}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {cwd ? <span className="inline-flex flex-wrap items-center gap-2 text-muted-foreground">cwd <PathLink path={cwd} /></span> : <span className="text-muted-foreground">{t('cwd: not recorded')}</span>}
        {file ? <button type="button" className="font-medium text-primary hover:underline" onClick={() => onOpenFile(file)}>{t('View output →')}</button> : <span className="text-muted-foreground">{t('No output file yet')}</span>}
      </div>
      {rows.map(row => <Tails key={row.id} check={row} />)}
      {rows.map(row => <p key={`identity-${row.id}`} className="m-0 break-all font-mono text-[11px] text-muted-foreground">#{row.id} · {t('run {n}', { n: row.runSeq })} · {t('Input digest')}: {row.inputDigest ?? t('Not recorded')}</p>)}
    </div> : null}
  </li>;
}

/** One latest run per exact runner/authority/phase/name, selected by the read API. */
export function CheckList({ attempt, onOpenFile }: Readonly<{ attempt: AttemptDetailV2; onOpenFile: (file: EvidenceFile) => void }>) {
  const summary = verificationSummary(attempt);
  const pairs = summary.pairs;
  const confirmed = summary.passed;
  const red = summary.failed;
  const lech = pairs.filter(pair => { const o = opSide(pair); const r = runtimeSide(pair); return (o.verdict != null && r.verdict != null && o.verdict !== r.verdict) || (o.exit != null && r.exit != null && o.exit !== r.exit); }).length;
  return <Card id="attempt-step-checks" concept="C9" title={t('Verification')} hint={pairs.length ? t('{checks} check identities · {runs} recorded runs · runtime confirmed {done}/{total}', { checks: pairs.length, runs: summary.runs, done: confirmed, total: summary.runtimeTotal }) : undefined}
    right={pairs.length ? <>{red ? <StatusChip status="failed" label={t('{n} failed', { n: red })} /> : null}{lech ? <StatusChip status="retry" label={t('{n} mismatched', { n: lech })} /> : null}</> : null}>
    {pairs.length ? <>
      <div className="hidden grid-cols-[auto_minmax(0,1fr)_9rem_13rem_auto] gap-x-3 border-b px-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground sm:grid"><span className="w-4" /><span>Check</span><span>{t('Op declared')}</span><span>{t('Runtime ran')}</span><span /></div>
      <p className="my-2 text-xs text-muted-foreground">{t('Check runs, Op-declared criteria and recorded conditions have separate scopes.')}</p>
      <ul className="divide-y">{pairs.map(pair => <PairRow key={pair.key} pair={pair} files={attempt.files} onOpenFile={onOpenFile} />)}</ul>
    </> : <Empty>{t('No checks recorded for this attempt yet.')}</Empty>}
  </Card>;
}
