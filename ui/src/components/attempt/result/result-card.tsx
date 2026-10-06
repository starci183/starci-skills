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
import { t } from '../../../i18n/t';
import { refreshQuery } from '../../../api/query';
import { FeedbackState } from '../../feedback-state';
import { CheckpointReceipt } from '../checkpoint';

export const concept: Concept = 'C10';

const outcomeLabels: Record<string, string> = { done: t('Done'), partial: t('Partial'), failed: t('Failed'), ask: t('Needs a question'), blocked: t('Blocked') };
const verdictLabels: Record<string, string> = { pass: t('Pass'), fail: t('Fail'), partial: t('Partial'), blocked: t('Blocked'), dropped: t('Dropped'), cancelled: t('Cancelled') };

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
  if (/^(pass|passed|ok|true|done)$/i.test(outcome)) return { status: 'success', label: t('passed') };
  if (/^(fail|failed|false|blocked)$/i.test(outcome)) return { status: 'failed', label: t('failed') };
  if (/^(skip|skipped|deferred)$/i.test(outcome)) return { status: 'deferred', label: t('deferred') };
  return { status: 'unknown', label: outcome || t('unknown') };
}
const icons: Partial<Record<Status, typeof CircleCheck>> = { success: CircleCheck, failed: CircleAlert, deferred: CircleMinus };
const toneOf = (s: Status) => (s === 'success' ? 'success' : s === 'failed' ? 'failed' : 'skipped');

function Assertions({ manifest }: Readonly<{ manifest: AttemptManifest }>) {
  const rows = manifest.assertions.map((a, i) => ({ ...a, key: `${a.id}-${i}`, ...assertionStatus(a.outcome) }));
  const pass = rows.filter(r => r.status === 'success').length;
  const fail = rows.filter(r => r.status === 'failed').length;
  if (!rows.length) return <p className="text-sm text-muted-foreground">{t('The manifest declares no assertions.')}</p>;
  return <div className="min-w-0">
    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
      <h3 className="m-0 font-medium">{t('The op\'s assertion list')}</h3>
      {manifest.outcome ? <span className="text-xs text-muted-foreground">{t('manifest concludes: {outcome}', { outcome: manifest.outcome })}</span> : null}
      <span className="ml-auto text-xs text-muted-foreground">{t('{pass}/{total} Op-declared criteria passed', { pass, total: rows.length })}{fail ? t(' · {n} failed', { n: fail }) : ''}</span>
    </div>
    <div className="mb-3 flex h-2 w-full gap-1 overflow-hidden rounded-full" role="img" aria-label={t('{pass} passed, {fail} failed, {other} other', { pass, fail, other: rows.length - pass - fail })}>
      {rows.map((r, i) => <span key={r.key} data-tone={toneOf(r.status)} className="flex h-full min-w-1 flex-1"><Grow className="block size-full bg-[var(--tone)]" delay={i * 0.02} title={`${r.id}: ${r.label}`} /></span>)}
    </div>
    <ul className="divide-y rounded-lg border">
      {rows.map((r) => {
        const Icon = icons[r.status] ?? CircleHelp;
        return <li key={r.key} data-tone={toneOf(r.status)} className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1 p-3 text-sm">
          <Icon className="mt-0.5 size-4 shrink-0 text-[var(--tone)]" aria-hidden="true" />
          <code className="min-w-0 break-all font-mono text-xs font-semibold">{r.id}</code>
          <StatusChip status={r.status} label={r.label} />
          {r.detail ? <p className="m-0 w-full min-w-0 break-words pl-8 text-muted-foreground sm:w-auto sm:flex-1 sm:pl-0">{r.detail}</p> : null}
        </li>;
      })}
    </ul>
  </div>;
}

/** Block 4 "Conclusion": what the op says, the manifest checklist, claims, and the kernel's verdict with the reason. */
export function ResultCard({ attempt }: Readonly<{ attempt: AttemptDetailV3 }>) {
  const manifest = useManifest(attempt);
  const opStatus = statusFromOutcome(attempt.reportOutcome);
  const verdictStatus = statusFromVerdict(attempt.verdict, attempt.reportedAt != null && attempt.settledAt == null && attempt.endState == null, attempt.ui);
  const settle = settleView(attempt);
  const claims = claimsOf(attempt);
  const reportSummary = obj(attempt.report?.json)?.summary;
  const summary = typeof reportSummary === 'string' && reportSummary ? reportSummary : attempt.summary;
  const nextAttempt = attempt.retry.next;
  const opTone = opStatus === 'success' ? 'success' : opStatus === 'blocked' || opStatus === 'failed' ? 'failed' : 'warning';
  const verdictTone = verdictStatus === 'success' ? 'success' : verdictStatus === 'blocked' || verdictStatus === 'failed' ? 'failed' : verdictStatus === 'awaiting-owner' ? 'owner' : verdictStatus === 'running' ? 'running' : verdictStatus === 'dropped' || verdictStatus === 'rejected' ? 'skipped' : 'queued';
  const hasAssertions = Boolean(manifest?.assertions.length);
  const failed = manifest ? manifest.assertions.filter(r => assertionStatus(r.outcome).status === 'failed').length : 0;
  const hasMore = hasAssertions || claims.frs.length > 0 || claims.paths.length > 0;
  const moreSummary = [hasAssertions && manifest ? `${t('{pass}/{total} Op-declared criteria passed', { pass: manifest.assertions.filter(r => assertionStatus(r.outcome).status === 'success').length, total: manifest.assertions.length })}${failed ? ` · ${t('{n} failed', { n: failed })}` : ''}` : null, claims.frs.length ? `${claims.frs.length} FR` : null].filter(Boolean).join(' · ');
  return <Card id="attempt-result" concept="C10" title={t('Outcome')} hint={t('what the op reported, the recorded verdict, and why')}>
    <div className="grid min-w-0 gap-6">
      <section className="min-w-0" data-tone={attempt.reportOutcome ? opTone : 'queued'}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-sm font-medium">{t('Op report')}</h3>
          {attempt.reportOutcome ? <StatusChip status={opStatus} label={outcomeLabels[attempt.reportOutcome] ?? attempt.reportOutcome} /> : <StatusChip status={attempt.reportedAt ? 'unknown' : 'queued'} label={attempt.reportedAt ? t('Report outcome not recorded') : t('No report yet')} />}
        </div>
        {summary ? <p className="m-0 max-w-[72ch] whitespace-pre-line break-words rounded-lg border-l-4 border-[var(--tone-line)] bg-[var(--tone-bg)] px-4 py-3 text-[15px] leading-relaxed">{summary}</p>
          : <p className="m-0 rounded-lg border p-3 text-sm text-muted-foreground">{t('The op has not written a result summary.')}</p>}
      </section>

      <CheckpointReceipt attempt={attempt} />

      <section className="min-w-0 border-t pt-6" data-tone={verdictTone}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Gavel className="size-4 text-[var(--tone)]" aria-hidden="true" />
          <h3 className="m-0 text-sm font-medium">{t('Recorded verdict')}</h3>
          <StatusChip status={verdictStatus} label={verdictStatus === 'awaiting-owner' ? t('Awaiting the owner') : verdictStatus === 'rejected' ? t('Rejected at dispatch') : attempt.verdict ? (verdictLabels[attempt.verdict] ?? attempt.verdict) : verdictStatus === 'running' ? t('Settling') : t('Not settled')} />
          {attempt.settledBy ? <span className="text-xs text-muted-foreground">{t('by {actor}', { actor: attempt.settledBy })}</span> : null}
        </div>
        {attempt.why ? <WhyBlock why={attempt.why} className="mb-4 max-w-[80ch]" /> : null}
        {attempt.why?.provenance?.source === 'computed' ? <p className="text-xs text-muted-foreground">{t('Explanation computed from current reference data; it is not a stored settlement receipt.')}</p> : null}
        {settle.lines.length ? <ul className="m-0 flex max-w-[72ch] list-disc flex-col gap-1 pl-6 text-sm">{settle.lines.map((line, i) => ({ key: `${i}-${line}`, line })).map(item => <li key={item.key} className="break-words">{item.line}</li>)}</ul>
          : <p className="m-0 text-sm text-muted-foreground">{attempt.verdict ? t('No additional verdict reason was recorded.') : t('No verdict has been recorded for this attempt yet.')}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4 text-sm">
          <span className="text-muted-foreground">{t('Next step:')}</span>
          <span className="min-w-0 break-words">{settle.nextStep ?? (nextAttempt ? t('Run the next attempt.') : t('No next step recorded yet.'))}</span>
          {nextAttempt ? <a href={nextAttempt.href} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">{t('Next attempt #{id}', { id: nextAttempt.id })}<ArrowRight className="size-3.5" aria-hidden="true" /></a> : null}
        </div>
      </section>

      {attempt.manifestRead?.state === 'unavailable' || attempt.manifestRead?.state === 'invalid' ? <FeedbackState error onRetry={() => refreshQuery(`/api/attempts/${encodeURIComponent(attempt.project)}/${attempt.id}`)}>{t('The submitted manifest could not be read; its criteria are unknown.')} · {attempt.manifestRead.state}</FeedbackState> : null}

      {hasMore ? <Advanced summary={moreSummary || undefined} defaultOpen={failed > 0}>
        <div className="grid min-w-0 gap-6">
          {manifest ? <Assertions manifest={manifest} /> : null}
          {claims.frs.length || claims.paths.length ? <section className="min-w-0">
            <h3 className="m-0 mb-2 text-sm font-medium">{t('Requirements (FR) the op claims it did')}</h3>
            {claims.frs.length ? <ul className="m-0 flex list-none flex-wrap gap-2 p-0">{claims.frs.map(fr => <li key={fr} className="min-w-0"><code className="inline-block max-w-full break-all rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs">{fr}</code></li>)}</ul> : null}
            {claims.paths.length ? <p className="mb-0 mt-2 break-all text-xs text-muted-foreground">{t('Claimed paths: {paths}', { paths: claims.paths.join(', ') })}</p> : null}
          </section> : null}
        </div>
      </Advanced> : null}
    </div>
  </Card>;
}
