import { useState } from 'react';
import { CircleAlert, CircleCheck, CircleHelp, CircleMinus, Copy, TriangleAlert } from 'lucide-react';
import type { AttemptDetailV2, CheckRow, EvidenceFile } from '../../contract';
import type { Concept } from '../concept';
import { BlobText } from '../blob-text';
import { PathLink } from '../path-link';
import { statusFromCheck, statusLabels, type Status } from '../status';
import { StatusChip } from '../status-chip';
import { Card, Empty } from './frame/card';
import { formatSpan } from './frame/util';

export const concept: Concept = 'C9';

const phaseLabels: Record<CheckRow['phase'], string> = { before: 'trước', after: 'sau', verify: 'xác minh', parity: 'đối chiếu', integrate: 'tích hợp' };
const runnerLabels: Record<CheckRow['runner'], string> = { op: 'op', settler: 'settler', kernel: 'kernel', parity: 'parity', integrate: 'integrate' };
const icons: Partial<Record<Status, typeof CircleCheck>> = { success: CircleCheck, failed: CircleAlert, retry: TriangleAlert, deferred: CircleMinus };

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

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground" title="Chép lệnh" onClick={() => {
    void navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }, () => undefined);
  }}><Copy className="size-3" aria-hidden="true" />{copied ? 'Đã chép' : 'Chép'}</button>;
}

function matchFile(files: EvidenceFile[], check: CheckRow): EvidenceFile | null {
  return files.find(file => file.check?.id === check.id)
    ?? files.find(file => file.group === 'check' && file.check?.name === check.name)
    ?? files.find(file => file.check?.name === check.name)
    ?? null;
}

function CheckItem({ check, files, onOpenFile }: { check: CheckRow; files: EvidenceFile[]; onOpenFile: (file: EvidenceFile) => void }) {
  const status = statusFromCheck(check.status);
  const Icon = icons[status] ?? CircleHelp;
  const file = matchFile(files, check);
  const declared = check.authority === 'declared';
  const mismatch = check.exitCode != null && check.declaredExitCode != null && check.exitCode !== check.declaredExitCode;
  const evidence = evidenceText(check.summary) ?? check.note;
  const tails = [check.stdout && ['stdout', check.stdout] as const, check.stderr && ['stderr', check.stderr] as const, check.output && ['output', check.output] as const].filter((item): item is NonNullable<typeof item> => Boolean(item));
  return <li className="min-w-0 py-4 first:pt-0 last:pb-0" data-tone={status === 'success' ? 'success' : status === 'failed' ? 'failed' : status === 'retry' ? 'warning' : status === 'deferred' ? 'skipped' : 'queued'}>
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
      <Icon className="size-4 shrink-0 text-[var(--tone)]" aria-hidden="true" />
      <strong className="min-w-0 break-words">{check.name}</strong>
      <StatusChip status={status} label={check.status === 'pass' ? 'Đạt' : check.status === 'fail' ? 'Hỏng' : statusLabels[status]} />
      <span className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">{phaseLabels[check.phase]}</span>
      <span className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">runner: {runnerLabels[check.runner]}</span>
      <span className="rounded border px-1.5 py-0.5 text-[11px]" data-tone={declared ? 'warning' : 'success'} style={{ borderColor: 'var(--tone-line)', color: 'var(--tone)' }} title={declared ? 'Op tự khai kết quả; runtime không chạy lại check này.' : 'Runtime tự chạy lệnh và ghi kết quả.'}>{declared ? 'op tự khai' : 'runtime chạy'}</span>
      <span className="ml-auto text-xs text-muted-foreground">{check.wallMs == null ? 'thời gian: —' : formatSpan(check.wallMs)}</span>
    </div>
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span>Exit chạy: <b className="text-foreground">{check.exitCode ?? '—'}</b></span>
      <span>Exit op khai: <b className="text-foreground">{check.declaredExitCode ?? '—'}</b></span>
      {mismatch ? <span className="inline-flex items-center gap-1 font-medium" data-tone="warning" style={{ color: 'var(--tone)' }}><TriangleAlert className="size-3.5" aria-hidden="true" />Lệch: runtime {check.exitCode}, op khai {check.declaredExitCode}</span> : null}
      {declared && check.exitCode == null ? <span>Runtime không ghi exit code cho check này.</span> : null}
    </div>
    {evidence ? <p className="mt-2 break-words text-sm">{evidence}</p> : null}
    {check.command ? <div className="mt-2 flex min-w-0 items-start gap-2 rounded-md border bg-muted/30 p-2"><code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs">{check.command}</code><CopyButton value={check.command} /></div> : <p className="mt-2 text-xs text-muted-foreground">Không ghi lệnh.</p>}
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {check.cwd ? <span className="inline-flex flex-wrap items-center gap-1.5 text-muted-foreground">cwd <PathLink path={check.cwd} /></span> : <span className="text-muted-foreground">cwd: không ghi</span>}
      {file ? <button type="button" className="font-medium text-primary hover:underline" onClick={() => onOpenFile(file)}>Xem output →</button> : <span className="text-muted-foreground">Chưa có tệp output</span>}
    </div>
    {tails.length ? <details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Đuôi {tails.map(([label]) => label).join(' / ')}</summary>
      <div className="mt-2 grid gap-2">{tails.map(([label, blob]) => <div key={label}><p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label} · {blob.bytes.toLocaleString('vi-VN')} B</p><div className="max-h-56 overflow-auto"><BlobText blob={blob} mode="tail" lines={40} /></div></div>)}</div></details> : null}
  </li>;
}

/** One row per check with pass/fail colour, authority, exit codes, full command and a link to its output file. */
export function CheckList({ attempt, onOpenFile }: { attempt: AttemptDetailV2; onOpenFile: (file: EvidenceFile) => void }) {
  const ok = attempt.checks.filter(check => check.status === 'pass').length;
  const red = attempt.checks.filter(check => check.status === 'fail' || check.status === 'error').length;
  const other = attempt.checks.length - ok - red;
  const declared = attempt.checks.some(check => check.authority === 'declared');
  return <Card id="attempt-step-checks" concept="C9" title="Check" hint={declared ? 'op tự khai (declared): runtime không chạy lại, không tính vào verdict runtime' : 'runtime chạy và ghi kết quả'}
    right={attempt.checks.length ? <>{ok ? <StatusChip status="success" label={`${ok} đạt`} /> : null}{red ? <StatusChip status="failed" label={`${red} hỏng`} /> : null}{other ? <StatusChip status="retry" label={`${other} khác`} /> : null}</> : null}>
    {attempt.checks.length ? <ul className="divide-y">{attempt.checks.map(check => <CheckItem key={check.id} check={check} files={attempt.files} onOpenFile={onOpenFile} />)}</ul> : <Empty>Chưa có check nào được ghi cho lần thử này.</Empty>}
  </Card>;
}
