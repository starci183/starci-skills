import { ArrowRight, CircleAlert, CircleCheck, CircleHelp, CircleMinus, Gavel } from 'lucide-react';
import type { AttemptDetailV3, AttemptManifest } from '../../../contract';
import type { Concept } from '../../concept';
import { statusFromOutcome, statusFromVerdict, type Status } from '../../status';
import { StatusChip } from '../../status-chip';
import { Advanced, Grow } from '../../motion';
import { Card } from '../frame/card';
import { useManifest } from './manifest';
import { settleView } from './settle-text';
import { WhyBlock } from '../../why/why-block';

export const concept: Concept = 'C10';

const outcomeLabels: Record<string, string> = { done: 'Hoàn tất', partial: 'Một phần', failed: 'Thất bại', ask: 'Cần hỏi', blocked: 'Bị chặn' };
const verdictLabels: Record<string, string> = { pass: 'Đạt', fail: 'Không đạt', partial: 'Một phần', blocked: 'Bị chặn', dropped: 'Đã bỏ', cancelled: 'Đã huỷ' };

const obj = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null);

/** FR ids (and touched paths) from `report.json.claims[]`, de-duplicated. */
function claimsOf(attempt: AttemptDetailV3): { frs: string[]; paths: string[] } {
  const raw = obj(attempt.report?.json)?.claims;
  const frs = new Set<string>(); const paths = new Set<string>();
  for (const claim of Array.isArray(raw) ? raw : []) {
    if (typeof claim === 'string') { frs.add(claim); continue; }
    const rec = obj(claim); if (!rec) continue;
    for (const fr of Array.isArray(rec.frs) ? rec.frs : []) if (typeof fr === 'string') frs.add(fr);
    for (const path of Array.isArray(rec.paths) ? rec.paths : []) if (typeof path === 'string') paths.add(path);
  }
  return { frs: [...frs], paths: [...paths] };
}

type AssertStatus = { status: Status; label: string };
function assertionStatus(outcome: string): AssertStatus {
  if (/^(pass|passed|ok|true|done)$/i.test(outcome)) return { status: 'success', label: 'đạt' };
  if (/^(fail|failed|false|blocked)$/i.test(outcome)) return { status: 'failed', label: 'không đạt' };
  if (/^(skip|skipped|deferred)$/i.test(outcome)) return { status: 'deferred', label: 'hoãn' };
  return { status: 'unknown', label: outcome || 'chưa rõ' };
}
const icons: Partial<Record<Status, typeof CircleCheck>> = { success: CircleCheck, failed: CircleAlert, deferred: CircleMinus };
const toneOf = (s: Status) => (s === 'success' ? 'success' : s === 'failed' ? 'failed' : 'skipped');

function Assertions({ manifest }: { manifest: AttemptManifest }) {
  const rows = manifest.assertions.map(a => ({ ...a, ...assertionStatus(a.outcome) }));
  const pass = rows.filter(r => r.status === 'success').length;
  const fail = rows.filter(r => r.status === 'failed').length;
  if (!rows.length) return <p className="text-sm text-muted-foreground">Manifest không khai điều kiện kiểm nào.</p>;
  return <div className="min-w-0">
    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
      <h3 className="m-0 font-medium">Danh sách điều kiện của op</h3>
      {manifest.outcome ? <span className="text-xs text-muted-foreground">manifest kết luận: {manifest.outcome}</span> : null}
      <span className="ml-auto text-xs text-muted-foreground">{pass}/{rows.length} đạt{fail ? ` · ${fail} không đạt` : ''}</span>
    </div>
    <div className="mb-3 flex h-2 w-full gap-1 overflow-hidden rounded-full" role="img" aria-label={`${pass} đạt, ${fail} không đạt, ${rows.length - pass - fail} khác`}>
      {rows.map((r, i) => <span key={`${r.id}-${i}`} data-tone={toneOf(r.status)} className="flex h-full min-w-1 flex-1"><Grow className="block size-full bg-[var(--tone)]" delay={i * 0.02} title={`${r.id}: ${r.label}`} /></span>)}
    </div>
    <ul className="divide-y rounded-lg border">
      {rows.map((r, i) => {
        const Icon = icons[r.status] ?? CircleHelp;
        return <li key={`${r.id}-${i}`} data-tone={toneOf(r.status)} className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1 p-3 text-sm">
          <Icon className="mt-0.5 size-4 shrink-0 text-[var(--tone)]" aria-hidden="true" />
          <code className="min-w-0 break-all font-mono text-xs font-semibold">{r.id}</code>
          <StatusChip status={r.status} label={r.label} />
          {r.detail ? <p className="m-0 w-full min-w-0 break-words pl-8 text-muted-foreground sm:w-auto sm:flex-1 sm:pl-0">{r.detail}</p> : null}
        </li>;
      })}
    </ul>
  </div>;
}

/** Block 4 "Kết luận": what the op says, the manifest checklist, claims, and the kernel's verdict with the reason. */
export function ResultCard({ attempt }: { attempt: AttemptDetailV3 }) {
  const manifest = useManifest(attempt);
  const opStatus = statusFromOutcome(attempt.reportOutcome);
  const verdictStatus = statusFromVerdict(attempt.verdict, attempt.settledAt == null && attempt.endState == null, attempt.ui);
  const settle = settleView(attempt);
  const claims = claimsOf(attempt);
  const reportSummary = obj(attempt.report?.json)?.summary;
  const summary = typeof reportSummary === 'string' && reportSummary ? reportSummary : attempt.summary;
  const nextAttempt = attempt.retry.next;
  const opTone = opStatus === 'success' ? 'success' : opStatus === 'blocked' || opStatus === 'failed' ? 'failed' : 'warning';
  const verdictTone = verdictStatus === 'success' ? 'success' : verdictStatus === 'blocked' || verdictStatus === 'failed' ? 'failed' : verdictStatus === 'dropped' ? 'skipped' : 'queued';
  const hasAssertions = Boolean(manifest?.assertions.length);
  const failed = manifest ? manifest.assertions.filter(r => assertionStatus(r.outcome).status === 'failed').length : 0;
  const hasMore = hasAssertions || claims.frs.length > 0 || claims.paths.length > 0;
  const moreSummary = [hasAssertions && manifest ? `${manifest.assertions.filter(r => assertionStatus(r.outcome).status === 'success').length}/${manifest.assertions.length} điều kiện đạt${failed ? ` · ${failed} không đạt` : ''}` : null, claims.frs.length ? `${claims.frs.length} FR` : null].filter(Boolean).join(' · ');
  return <Card id="attempt-result" concept="C10" title="Kết luận" hint="Op tự báo gì, kernel chốt gì, và vì sao">
    <div className="grid min-w-0 gap-6">
      <section className="min-w-0" data-tone={attempt.reportOutcome ? opTone : 'queued'}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-sm font-medium">Op báo cáo</h3>
          {attempt.reportOutcome ? <StatusChip status={opStatus} label={outcomeLabels[attempt.reportOutcome] ?? attempt.reportOutcome} /> : <StatusChip status="queued" label="Chưa có báo cáo" />}
        </div>
        {summary ? <p className="m-0 max-w-[72ch] whitespace-pre-line break-words rounded-lg border-l-4 border-[var(--tone-line)] bg-[var(--tone-bg)] px-4 py-3 text-[15px] leading-relaxed">{summary}</p>
          : <p className="m-0 rounded-lg border p-3 text-sm text-muted-foreground">Op chưa ghi tóm tắt kết quả.</p>}
      </section>

      <section className="min-w-0 border-t pt-6" data-tone={verdictTone}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Gavel className="size-4 text-[var(--tone)]" aria-hidden="true" />
          <h3 className="m-0 text-sm font-medium">Kernel chốt</h3>
          <StatusChip status={verdictStatus} label={attempt.verdict ? (verdictLabels[attempt.verdict] ?? attempt.verdict) : 'Chưa chốt'} />
          {attempt.settledBy ? <span className="text-xs text-muted-foreground">bởi {attempt.settledBy}</span> : null}
        </div>
        {attempt.why ? <WhyBlock why={attempt.why} className="mb-4 max-w-[80ch]" /> : null}
        {settle.lines.length ? <ul className="m-0 flex max-w-[72ch] list-disc flex-col gap-1 pl-6 text-sm">{settle.lines.map((line, i) => <li key={i} className="break-words">{line}</li>)}</ul>
          : <p className="m-0 text-sm text-muted-foreground">{attempt.verdict ? 'Kernel không ghi thêm lý do nào ngoài kết luận.' : 'Kernel chưa chốt lần thử này.'}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4 text-sm">
          <span className="text-muted-foreground">Bước tiếp:</span>
          <span className="min-w-0 break-words">{settle.nextStep ?? (attempt.verdict === 'pass' ? 'Không cần làm lại; kernel chuyển sang chặng sau.' : nextAttempt ? 'Chạy lần thử kế tiếp.' : 'Chưa có bước tiếp được ghi.')}</span>
          {nextAttempt ? <a href={nextAttempt.href} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Lần thử kế tiếp #{nextAttempt.id}<ArrowRight className="size-3.5" aria-hidden="true" /></a> : null}
        </div>
      </section>

      {hasMore ? <Advanced summary={moreSummary || undefined} defaultOpen={failed > 0}>
        <div className="grid min-w-0 gap-6">
          {manifest ? <Assertions manifest={manifest} /> : null}
          {claims.frs.length || claims.paths.length ? <section className="min-w-0">
            <h3 className="m-0 mb-2 text-sm font-medium">Yêu cầu (FR) mà op nhận đã làm</h3>
            {claims.frs.length ? <ul className="m-0 flex list-none flex-wrap gap-2 p-0">{claims.frs.map(fr => <li key={fr} className="min-w-0"><code className="inline-block max-w-full break-all rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs">{fr}</code></li>)}</ul> : null}
            {claims.paths.length ? <p className="mb-0 mt-2 break-all text-xs text-muted-foreground">Đường dẫn khai kèm: {claims.paths.join(', ')}</p> : null}
          </section> : null}
        </div>
      </Advanced> : null}
    </div>
  </Card>;
}
