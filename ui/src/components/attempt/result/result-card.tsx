import { ArrowRight, Gavel } from 'lucide-react';
import type { AttemptDetailV3, AttemptManifest } from '../../../contract';
import type { Concept } from '../../concept';
import { statusFromVerdict, statusTone } from '../../status';
import { StatusChip } from '../../status-chip';
import { Advanced } from '../../motion';
import { Card } from '../frame/card';
import { manifestOf } from './manifest';
import { settleView } from './settle-text';
import { WhyBlock } from '../../why/why-block';
import { t } from '../../../i18n/t';
import { formatAbsolute } from '../../../i18n/vi';
import { refreshQuery } from '../../../api/query';
import { FeedbackState } from '../../feedback-state';
import { CheckpointReceipt } from '../checkpoint';
import { verificationSummary } from '../verification';
import { TextView } from '../../evidence/renderers/text-view';

export const concept: Concept = 'C10';

const outcomeLabels: Record<string, string> = { done: t('Done'), partial: t('Partial'), failed: t('Failed'), ask: t('Needs a question'), blocked: t('Blocked') };
const verdictLabels: Record<string, string> = { pass: t('Pass'), fail: t('Fail'), partial: t('Partial'), blocked: t('Blocked'), dropped: t('Dropped'), cancelled: t('Cancelled') };

const obj = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null);
const text = (value: unknown): string | null => typeof value === 'string' && value.length ? value : null;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const jsonText = (value: unknown): string => JSON.stringify(value, null, 2) ?? 'null';

/** Render only named report-envelope fields, retaining their submitted text and order. */
function ReportDetails({ report }: Readonly<{ report: Record<string, unknown> | null }>) {
  const open = strings(report?.open);
  const blocker = obj(report?.blocker);
  const question = obj(report?.question);
  const rootCause = obj(report?.rootCause);
  const options = Array.isArray(question?.options) ? question.options.map(option => typeof option === 'string' ? option : text(obj(option)?.label)).filter((option): option is string => option != null) : [];
  const evidence = strings(rootCause?.evidence);
  if (!open.length && !text(blocker?.detail) && !text(question?.text) && !text(rootCause?.claim)) return null;
  return <div className="mt-4 grid min-w-0 gap-4">
    {open.length ? <section className="min-w-0" data-tone="warning">
      <h4 className="m-0 mb-1 text-sm font-medium text-[var(--tone)]">{t('Unfinished items reported by the Op')}</h4>
      <ul className="m-0 list-disc space-y-1 pl-5 text-sm leading-relaxed">{open.map((item, i) => <li key={`${i}-${item}`} className="whitespace-pre-line break-words">{item}</li>)}</ul>
    </section> : null}
    {text(blocker?.detail) ? <section className="min-w-0" data-tone="warning">
      <h4 className="m-0 mb-1 text-sm font-medium text-[var(--tone)]">{t('Blocker reported by the Op')}</h4>
      <p className="m-0 whitespace-pre-line break-words text-sm leading-relaxed">{text(blocker?.detail)}</p>
      {text(blocker?.kind) ? <p className="mb-0 mt-1 text-xs text-muted-foreground">{t('Declared kind')}: <code>{text(blocker?.kind)}</code></p> : null}
    </section> : null}
    {text(question?.text) ? <section className="min-w-0">
      <h4 className="m-0 mb-1 text-sm font-medium">{t('Question reported by the Op')}</h4>
      <p className="m-0 whitespace-pre-line break-words text-sm leading-relaxed">{text(question?.text)}</p>
      {options.length ? <ul className="mb-0 mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{options.map((option, i) => <li key={`${i}-${option}`} className="break-words">{option}</li>)}</ul> : null}
    </section> : null}
    {text(rootCause?.claim) ? <section className="min-w-0" data-tone="warning">
      <h4 className="m-0 mb-1 text-sm font-medium text-[var(--tone)]">{t('Cause claimed by the Op')}</h4>
      <p className="m-0 whitespace-pre-line break-words text-sm leading-relaxed">{text(rootCause?.claim)}</p>
      {evidence.length ? <ul className="mb-0 mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{evidence.map((item, i) => <li key={`${i}-${item}`} className="break-words">{item}</li>)}</ul> : null}
    </section> : null}
  </div>;
}

/** Exact manifest declarations carry no UI-derived pass/fail certification. */
function Assertions({ manifest }: Readonly<{ manifest: AttemptManifest }>) {
  return <section className="min-w-0">
    <h3 className="m-0 mb-1 text-sm font-medium">{t('The op\'s assertion list')}</h3>
    <p className="mb-3 mt-0 text-xs text-muted-foreground">{t('These are Op declarations; runtime check records are shown separately.')}</p>
    {manifest.outcome != null ? <p className="mb-2 mt-0 break-words text-sm">{t('Declared manifest outcome')}: <span>{manifest.outcome}</span></p> : null}
    {manifest.assertions.length ? <ul className="m-0 list-none divide-y p-0">
      {manifest.assertions.map((assertion, i) => <li key={`${assertion.id}-${i}`} className="grid min-w-0 gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
        <code className="min-w-0 break-all font-mono text-xs font-medium">{assertion.id}</code>
        <span className="min-w-0 break-words text-muted-foreground">{t('Declared result')}: {assertion.outcome}</span>
        {assertion.detail != null ? <p className="m-0 min-w-0 whitespace-pre-line break-words leading-relaxed sm:col-span-2">{assertion.detail}</p> : null}
      </li>)}
    </ul> : <p className="m-0 text-sm text-muted-foreground">{t('The manifest declares no assertions.')}</p>}
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">{t('Full submitted manifest data')}</summary>
      <div className="mt-3 min-w-0"><TextView text={jsonText(manifest)} query="" /></div>
    </details>
  </section>;
}

/** Independent report, runtime checks, checkpoint and verdict facts for one dispatch. */
export function ResultCard({ attempt, onShowChecks }: Readonly<{ attempt: AttemptDetailV3; onShowChecks?: () => void }>) {
  const manifest = manifestOf(attempt);
  const report = obj(attempt.report?.json);
  const summary = text(report?.summary) ?? attempt.summary;
  const hasClaims = report?.claims != null;
  const checks = verificationSummary(attempt);
  const verdictStatus = statusFromVerdict(attempt.verdict, attempt.reportedAt != null && attempt.settledAt == null && attempt.endState == null, attempt.ui);
  const settle = settleView(attempt);
  const nextAttempt = attempt.retry.next;
  const hasDeclarations = manifest != null || hasClaims;
  const declarationsSummary = [manifest ? t('{n} Op-declared assertions', { n: manifest.assertions.length }) : null, hasClaims ? t('Exact reported claims') : null].filter(Boolean).join(' · ');
  const checksHref = `#/a/${encodeURIComponent(attempt.project)}/${attempt.id}?step=checks`;
  return <Card id="attempt-result" concept="C10" title={t('Outcome')} hint={t('Op declarations, runtime checks, checkpoint and verdict')}>
    <div className="grid min-w-0 gap-6">
      <section className="min-w-0">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="m-0 text-sm font-medium">{t('Op report')}</h3>
          <span className="text-sm text-muted-foreground">{attempt.reportOutcome ? t('Self-reported outcome: {outcome}', { outcome: outcomeLabels[attempt.reportOutcome] ?? attempt.reportOutcome }) : attempt.reportedAt ? t('Report outcome not recorded') : t('No report yet')}</span>
        </div>
        <p className="mb-3 mt-0 text-xs text-muted-foreground">{t('Self-declared by the Op; runtime checks and the recorded verdict are separate.')}</p>
        {summary ? <p className="m-0 max-w-[80ch] whitespace-pre-line break-words text-sm leading-relaxed">{summary}</p>
          : <p className="m-0 text-sm text-muted-foreground">{t('No report summary was returned.')}</p>}
        {report ? <ReportDetails report={report} /> : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {attempt.report ? <span>{t('Stored report #{id}', { id: attempt.report.id })}</span> : null}
          {attempt.reportedAt != null ? <span>{t('Reported at {at}', { at: formatAbsolute(attempt.reportedAt) })}</span> : null}
        </div>
        {attempt.report?.json != null ? <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium hover:underline">{t('Read the full stored report')}</summary>
          <div className="mt-3 min-w-0"><TextView text={jsonText(attempt.report.json)} query="" /></div>
        </details> : attempt.reportedAt != null || attempt.report != null ? <p className="mb-0 mt-3 text-xs text-muted-foreground">{t('The reported milestone is recorded, but stored report content was not returned.')}</p> : null}
      </section>

      <section className="min-w-0 border-t pt-6">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="m-0 text-sm font-medium">{t('Runtime checks')}</h3>
          <a href={checksHref} onClick={onShowChecks ? event => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); onShowChecks();
          } : undefined} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">{t('View recorded checks')}<ArrowRight className="size-3.5" aria-hidden="true" /></a>
        </div>
        {checks.runtimeTotal ? <p className="m-0 text-sm leading-relaxed">{t('Runtime check identities: {passed} passed · {failed} failed · {unconfirmed} unconfirmed.', { passed: checks.passed, failed: checks.failed, unconfirmed: checks.unconfirmed })}</p>
          : <p className="m-0 text-sm text-muted-foreground">{t('No runtime check records were returned for this attempt.')}</p>}
        {checks.unavailable || checks.skipped ? <p className="mb-0 mt-1 text-xs text-muted-foreground">{t('Unconfirmed includes {unavailable} unavailable and {skipped} skipped checks.', { unavailable: checks.unavailable, skipped: checks.skipped })}</p> : null}
        <p className="mb-0 mt-2 text-xs text-muted-foreground">{t('Recorded scope: {identities} check identities · {runs} runs · {declared} declaration-only identities.', { identities: checks.total, runs: checks.runs, declared: checks.declaredTotal })}</p>
      </section>

      <CheckpointReceipt attempt={attempt} />

      <section className="min-w-0 border-t pt-6" data-tone={statusTone[verdictStatus]}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Gavel className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="m-0 text-sm font-medium">{t('Recorded runtime verdict')}</h3>
          <StatusChip status={verdictStatus} label={verdictStatus === 'awaiting-owner' ? t('Awaiting the owner') : verdictStatus === 'rejected' ? t('Rejected at dispatch') : attempt.verdict ? (verdictLabels[attempt.verdict] ?? attempt.verdict) : verdictStatus === 'running' ? t('Settling') : t('Not settled')} />
          {attempt.settledBy ? <span className="text-xs text-muted-foreground">{t('by {actor}', { actor: attempt.settledBy })}</span> : null}
          {attempt.settledAt != null ? <span className="text-xs text-muted-foreground">{formatAbsolute(attempt.settledAt)}</span> : null}
        </div>
        <p className="mb-4 mt-0 text-xs text-muted-foreground">{t('The runtime verdict comes from Attempt settlement. Checkpoint, workflow integration and product reads have separate receipts.')}</p>
        {attempt.why ? <>
          <p className="mb-2 mt-0 text-xs text-muted-foreground">{attempt.why.provenance?.source === 'stored' ? t('Stored explanation') : attempt.why.provenance?.source === 'computed' ? t('Explanation computed from current reference data; it is not a stored settlement receipt.') : t('Explanation source not recorded')}{attempt.why.provenance?.at != null ? ` · ${formatAbsolute(attempt.why.provenance.at)}` : ''}</p>
          <WhyBlock why={attempt.why} className="mb-4 max-w-[80ch]" />
        </> : null}
        {attempt.settle && settle.lines.length ? <ul className="m-0 flex max-w-[80ch] list-disc flex-col gap-1 pl-5 text-sm">{settle.lines.map((line, i) => <li key={`${i}-${line}`} className="break-words">{line}</li>)}</ul>
          : <p className="m-0 text-sm text-muted-foreground">{attempt.verdict ? t('No additional verdict reason was recorded.') : t('No verdict has been recorded for this attempt yet.')}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4 text-sm">
          <span className="text-muted-foreground">{t('Next step:')}</span>
          <span className="min-w-0 break-words">{settle.nextStep ?? t('No next step recorded yet.')}</span>
          {nextAttempt ? <a href={nextAttempt.href} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">{t('Next attempt #{id}', { id: nextAttempt.id })}<ArrowRight className="size-3.5" aria-hidden="true" /></a> : null}
        </div>
      </section>

      {attempt.manifestRead?.state === 'unavailable' || attempt.manifestRead?.state === 'invalid' ? <FeedbackState error onRetry={() => refreshQuery(`/api/attempts/${encodeURIComponent(attempt.project)}/${attempt.id}`)}>{t('The submitted manifest could not be read; its criteria are unknown.')} · {attempt.manifestRead.state}</FeedbackState> : null}

      {hasDeclarations ? <Advanced summary={declarationsSummary || undefined}>
        <div className="grid min-w-0 gap-6">
          {manifest ? <Assertions manifest={manifest} /> : null}
          {hasClaims ? <section className="min-w-0">
            <h3 className="m-0 mb-1 text-sm font-medium">{t('Exact reported claims')}</h3>
            <p className="mb-3 mt-0 text-xs text-muted-foreground">{t('Submitted claims are declarations; they do not establish requirement completion.')}</p>
            <TextView text={jsonText(report?.claims)} query="" />
          </section> : null}
        </div>
      </Advanced> : null}
    </div>
  </Card>;
}
