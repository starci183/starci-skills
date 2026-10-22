import { useState } from 'react';
import { Copy, TriangleAlert } from 'lucide-react';
import type { AttemptDetailV3, BlobLink, CheckPair, CheckRow, EvidenceFile } from '../../contract';
import type { Concept } from '../concept';
import { BlobText } from '../blob-text';
import { PathLink } from '../path-link';
import { StatusChip } from '../status-chip';
import { Card, Empty } from './frame/card';
import { formatSpan } from './frame/util';
import { t } from '../../i18n/t';
import { runtimeObservation, verificationSummary } from './verification';
import { Advanced } from '../motion';
import { Button } from '../ui/button';

/** The business concept id (C9) under which the verification check list is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
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

const CopyButton = ({ value }: Readonly<{ value: string }>) => {
  const [copied, setCopied] = useState(false);
  return <Button type="button" variant="outline" size="xs" title={t('Copy the command')} onClick={() => {
    void navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }, () => undefined);
  }}><Copy className="size-3" aria-hidden="true" />{copied ? t('Copied') : t('Copy')}</Button>;
};

const matchFile = (files: EvidenceFile[], check: CheckRow): EvidenceFile | null => {
  return files.find(file => file.check?.id === check.id)
    ?? files.find(file => [check.output?.sha, check.stdout?.sha, check.stderr?.sha].includes(file.sha))
    ?? null;
};

type Verdict = 'pass' | 'fail' | null;
type Side = { verdict: Verdict; exit: number | null };
const verdictOf = (status: CheckRow['status'] | undefined, exit: number | null | undefined): Verdict => {
  if (status === 'pass') return 'pass';
  if (status === 'fail' || status === 'error') return 'fail';
  if (exit != null) return exit === 0 ? 'pass' : 'fail';
  return null;
};

const opSide = (pair: CheckPair): Side => {
  if (pair.op) {
    const exit = pair.op.declaredExitCode ?? pair.op.exitCode;
    return { verdict: verdictOf(pair.op.status, exit), exit };
  }
  const declared = pair.runtime?.declaredExitCode ?? null;
  return { verdict: verdictOf(undefined, declared), exit: declared };
};
const runtimeSide = (pair: CheckPair): Side => {
  const row = pair.runtime;
  if (!row) return { verdict: null, exit: null };
  const observation = runtimeObservation(row);
  return { verdict: observation === 'pass' || observation === 'fail' ? observation : null, exit: row.exitCode };
};

const markLook = (verdict: Verdict): { tone: string; glyph: string } => {
  if (verdict === 'pass') return { tone: 'success', glyph: '✓' };
  if (verdict === 'fail') return { tone: 'failed', glyph: '✗' };
  return { tone: 'queued', glyph: '—' };
};

const Mark = ({ verdict, exit, extra }: Readonly<{ verdict: Verdict; exit: number | null; extra?: string | null }>) => {
  const { tone, glyph } = markLook(verdict);
  return <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs" data-tone={tone} style={{ color: 'var(--tone)' }}>
    <b className="text-sm">{glyph}</b>
    {exit != null ? <span className="font-mono">exit {exit}</span> : null}
    {extra ? <span className="text-muted-foreground">· {extra}</span> : null}
  </span>;
};

const Tails = ({ check }: Readonly<{ check: CheckRow }>) => {
  const tails: (readonly [string, BlobLink])[] = [];
  if (check.stdout) tails.push(['stdout', check.stdout]);
  if (check.stderr) tails.push(['stderr', check.stderr]);
  if (check.output) tails.push(['output', check.output]);
  if (!tails.length) return null;
  return <Advanced className="mt-4" title={t('Tail {labels}', { labels: tails.map(([label]) => label).join(' / ') })} keepMounted>
    <div className="grid gap-4">{tails.map(([label, blob]) => <div key={label}><p className="mb-2 mt-0 text-xs text-muted-foreground">{label} · {blob.bytes.toLocaleString('vi-VN')} B</p><div className="max-h-56 overflow-auto"><BlobText blob={blob} mode="tail" lines={40} /></div></div>)}</div></Advanced>;
};

const sidesMismatch = (op: Side, rt: Side): boolean =>
  (op.verdict != null && rt.verdict != null && op.verdict !== rt.verdict)
  || (op.exit != null && rt.exit != null && op.exit !== rt.exit);

const pairRows = (pair: CheckPair): CheckRow[] => {
  const rows: CheckRow[] = [];
  if (pair.runtime) rows.push(pair.runtime);
  if (pair.op) rows.push(pair.op);
  return rows;
};

const pairDetails = (pair: CheckPair, files: EvidenceFile[]) => {
  const rows = pairRows(pair);
  const main = pair.runtime ?? pair.op;
  return {
    rows,
    evidence: rows.map(row => evidenceText(row.summary) ?? row.note).find(Boolean) ?? null,
    command: main?.command ?? rows.find(row => row.command)?.command ?? null,
    cwd: main?.cwd ?? rows.find(row => row.cwd)?.cwd ?? null,
    file: rows.map(row => matchFile(files, row)).find(Boolean) ?? null,
  };
};

const pairTone = (rt: Side, mismatch: boolean) => {
  if (rt.verdict === 'fail') return 'failed';
  if (mismatch) return 'warning';
  return rt.verdict === 'pass' ? 'success' : 'queued';
};

const unconfirmedLabel = (status: CheckRow['status'] | undefined) => {
  if (status === 'unavailable') return t('Unavailable');
  if (status === 'skipped') return t('Skipped');
  return t('Not confirmed');
};

const RuntimeColumn = ({ pair, rt, mismatch }: Readonly<{ pair: CheckPair; rt: Side; mismatch: boolean }>) => {
  return <span className="flex min-w-0 flex-col items-start gap-1"><span className="text-xs font-normal text-muted-foreground">{t('Runtime ran')}</span><Mark verdict={rt.verdict} exit={rt.verdict == null ? null : rt.exit} extra={pair.runtime?.wallMs != null ? formatSpan(pair.runtime.wallMs) : null} />{rt.verdict == null ? <span className="text-xs font-normal text-muted-foreground">{unconfirmedLabel(pair.runtime?.status)}</span> : null}{mismatch ? <span className="inline-flex items-center gap-1 text-xs font-medium" data-tone="warning" style={{ color: 'var(--tone)' }} title={t('Op-declared and runtime-run do not match')}><TriangleAlert className="size-3.5" aria-hidden="true" />{t('Mismatch')}</span> : null}</span>;
};

const PairBody = ({ op, rt, mismatch, details, onOpenFile }: Readonly<{ op: Side; rt: Side; mismatch: boolean; details: ReturnType<typeof pairDetails>; onOpenFile: (file: EvidenceFile) => void }>) => {
  const { rows, evidence, command, cwd, file } = details;
  return <div className="min-w-0 space-y-4 text-sm">
    {evidence ? <p className="m-0 whitespace-pre-line break-words leading-relaxed">{evidence}</p> : null}
    {mismatch ? <p className="text-xs" data-tone="warning" style={{ color: 'var(--tone)' }}>{t('Mismatch: op declared {opExit}, runtime ran {runtimeExit}.', { opExit: op.exit ?? '—', runtimeExit: rt.exit ?? '—' })}</p> : null}
    {command ? <div className="flex min-w-0 items-start gap-3 rounded-lg bg-default p-3"><code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs leading-5">{command}</code><CopyButton value={command} /></div> : <p className="text-xs text-muted-foreground">{t('No command recorded.')}</p>}
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {cwd ? <span className="inline-flex flex-wrap items-center gap-2 text-muted-foreground">cwd <PathLink path={cwd} /></span> : <span className="text-muted-foreground">{t('cwd: not recorded')}</span>}
      {file ? <Button type="button" variant="link" size="sm" onClick={() => onOpenFile(file)}>{t('View output →')}</Button> : <span className="text-muted-foreground">{t('No output file yet')}</span>}
    </div>
    {rows.map(row => <Tails key={row.id} check={row} />)}
    {rows.map(row => <p key={`identity-${row.id}`} className="m-0 break-all font-mono text-[11px] text-muted-foreground">#{row.id} · {t('run {n}', { n: row.runSeq })} · {t('Input digest')}: {row.inputDigest ?? t('Not recorded')}</p>)}
  </div>;
};

const PairRow = ({ pair, files, onOpenFile }: Readonly<{ pair: CheckPair; files: EvidenceFile[]; onOpenFile: (file: EvidenceFile) => void }>) => {
  const op = opSide(pair);
  const rt = runtimeSide(pair);
  const mismatch = sidesMismatch(op, rt);
  const details = pairDetails(pair, files);
  return <li className="min-w-0" data-tone={pairTone(rt, mismatch)}>
    <Advanced title={<span className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_13rem]">
      <span className="min-w-0"><strong className="block break-words text-sm">{pair.name}</strong><span className="mt-1 block break-words text-xs font-normal text-muted-foreground">{pair.runner} · {pair.authority} · {pair.phase}</span></span>
      <span className="flex min-w-0 flex-col items-start gap-1"><span className="text-xs font-normal text-muted-foreground">{t('Op declared')}</span><Mark verdict={op.verdict} exit={op.exit} /></span>
      <RuntimeColumn pair={pair} rt={rt} mismatch={mismatch} />
    </span>}>
      <PairBody op={op} rt={rt} mismatch={mismatch} details={details} onOpenFile={onOpenFile} />
    </Advanced>
  </li>;
};

/** One latest run per exact runner/authority/phase/name, selected by the read API. */
export const CheckList = ({ attempt, onOpenFile }: Readonly<{ attempt: AttemptDetailV3; onOpenFile: (file: EvidenceFile) => void }>) => {
  const summary = verificationSummary(attempt);
  const pairs = summary.pairs;
  const confirmed = summary.passed;
  const red = summary.failed;
  const lech = pairs.filter(pair => sidesMismatch(opSide(pair), runtimeSide(pair))).length;
  return <Card id="attempt-step-checks" concept="C9" title={t('Verification')} hint={pairs.length ? t('{checks} check identities · {runs} recorded runs · runtime confirmed {done}/{total}', { checks: pairs.length, runs: summary.runs, done: confirmed, total: summary.runtimeTotal }) : undefined}
    right={pairs.length ? <>{red ? <StatusChip status="failed" label={t('{n} failed', { n: red })} /> : null}{lech ? <StatusChip status="retry" label={t('{n} mismatched', { n: lech })} /> : null}</> : null}>
    {pairs.length ? <>
      <p className="mb-3 mt-0 text-xs text-muted-foreground">{t('Check runs, Op-declared criteria and recorded conditions have separate scopes.')}</p>
      <ul className="m-0 list-none divide-y p-0">{pairs.map(pair => <PairRow key={pair.key} pair={pair} files={attempt.files} onOpenFile={onOpenFile} />)}</ul>
    </> : <Empty>{t('No checks recorded for this attempt yet.')}</Empty>}
  </Card>;
};
