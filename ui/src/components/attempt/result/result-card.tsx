import { ArrowRight, Gavel } from 'lucide-react';
import { Link } from '@heroui/react';
import type { AttemptDetailV3, AttemptManifest } from '../../../contract';
import type { Concept } from '../../concept';
import { statusFromVerdict, statusTone, type Status } from '../../status';
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
    <Advanced className="mt-4" title={t('Full submitted manifest data')} keepMounted>
      <TextView text={jsonText(manifest)} query="" />
    </Advanced>
  </section>;
}

type ClickEvent = { defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault: () => void };

const isPlainLeftClick = (event: ClickEvent): boolean => !(event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

function reportOutcomeText(attempt: AttemptDetailV3): string {
  if (attempt.reportOutcome) return t('Self-reported outcome: {outcome}', { outcome: outcomeLabels[attempt.reportOutcome] ?? attempt.reportOutcome });
  return attempt.reportedAt ? t('Report outcome not recorded') : t('No report yet');
}

function verdictChipLabel(status: Status, verdict: AttemptDetailV3['verdict']): string {
  if (status === 'awaiting-owner') return t('Awaiting the owner');
  if (status === 'rejected') return t('Rejected at dispatch');
  if (verdict) return verdictLabels[verdict] ?? verdict;
  return status === 'running' ? t('Settling') : t('Not settled');
}

function whySourceLabel(source: string | undefined): string {
  if (source === 'stored') return t('Stored explanation');
  if (source === 'computed') return t('Explanation computed from current reference data; it is not a stored settlement receipt.');
  return t('Explanation source not recorded');
}

function OpReportSection({ attempt, report, summary }: Readonly<{ attempt: AttemptDetailV3; report: Record<string, unknown> | null; summary: string | null }>) {
  return <section className="min-w-0">
    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 className="m-0 text-sm font-medium">{t('Op report')}</h3>
      <span className="text-sm text-muted-foreground">{reportOutcomeText(attempt)}</span>
    </div>
    <p className="mb-3 mt-0 text-xs text-muted-foreground">{t('Self-declared by the Op; runtime checks and the recorded verdict are separate.')}</p>
    {summary ? <p className="m-0 max-w-[80ch] whitespace-pre-line break-words text-sm leading-relaxed">{summary}</p>
      : <p className="m-0 text-sm text-muted-foreground">{t('No report summary was returned.')}</p>}
    {report ? <ReportDetails report={report} /> : null}
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {attempt.report ? <span>{t('Stored report #{id}', { id: attempt.report.id })}</span> : null}
      {attempt.reportedAt != null ? <span>{t('Reported at {at}', { at: formatAbsolute(attempt.reportedAt) })}</span> : null}
    </div>
    <StoredReport attempt={attempt} />
  </section>;
}

function StoredReport({ attempt }: Readonly<{ attempt: AttemptDetailV3 }>) {
  if (attempt.report?.json != null) return <Advanced className="mt-4" title={t('Read the full stored report')} keepMounted>
    <TextView text={jsonText(attempt.report.json)} query="" />
  </Advanced>;
  if (attempt.reportedAt != null || attempt.report != null) return <p className="mb-0 mt-3 text-xs text-muted-foreground">{t('The reported milestone is recorded, but stored report content was not returned.')}</p>;
  return null;
}

function RuntimeChecksSection({ attempt, onShowChecks }: Readonly<{ attempt: AttemptDetailV3; onShowChecks?: () => void }>) {
  const checks = verificationSummary(attempt);
  const checksHref = `#/a/${encodeURIComponent(attempt.project)}/${attempt.id}?step=checks`;
  const onClick = onShowChecks ? (event: ClickEvent) => {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault(); onShowChecks();
  } : undefined;
  return <section className="min-w-0 border-t pt-6">
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h3 className="m-0 text-sm font-medium">{t('Runtime checks')}</h3>
      <Link href={checksHref} onClick={onClick} className="gap-1 text-sm font-medium">{t('View recorded checks')}<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
    </div>
    {checks.runtimeTotal ? <p className="m-0 text-sm leading-relaxed">{t('Runtime check identities: {passed} passed · {failed} failed · {unconfirmed} unconfirmed.', { passed: checks.passed, failed: checks.failed, unconfirmed: checks.unconfirmed })}</p>
      : <p className="m-0 text-sm text-muted-foreground">{t('No runtime check records were returned for this attempt.')}</p>}
    {checks.unavailable || checks.skipped ? <p className="mb-0 mt-1 text-xs text-muted-foreground">{t('Unconfirmed includes {unavailable} unavailable and {skipped} skipped checks.', { unavailable: checks.unavailable, skipped: checks.skipped })}</p> : null}
    <p className="mb-0 mt-2 text-xs text-muted-foreground">{t('Recorded scope: {identities} check identities · {runs} runs · {declared} declaration-only identities.', { identities: checks.total, runs: checks.runs, declared: checks.declaredTotal })}</p>
  </section>;
}

function WhyExplanation({ why }: Readonly<{ why: NonNullable<AttemptDetailV3['why']> }>) {
  return <>
    <p className="mb-2 mt-0 text-xs text-muted-foreground">{whySourceLabel(why.provenance?.source)}{why.provenance?.at != null ? ` · ${formatAbsolute(why.provenance.at)}` : ''}</p>
    <WhyBlock why={why} className="mb-4 max-w-[80ch]" />
  </>;
}

function SettleReasons({ attempt, settle }: Readonly<{ attempt: AttemptDetailV3; settle: ReturnType<typeof settleView> }>) {
  if (attempt.settle && settle.lines.length) return <ul className="m-0 flex max-w-[80ch] list-disc flex-col gap-1 pl-5 text-sm">{settle.lines.map((line, i) => <li key={`${i}-${line}`} className="break-words">{line}</li>)}</ul>;
  return <p className="m-0 text-sm text-muted-foreground">{attempt.verdict ? t('No additional verdict reason was recorded.') : t('No verdict has been recorded for this attempt yet.')}</p>;
}

function VerdictSection({ attempt }: Readonly<{ attempt: AttemptDetailV3 }>) {
  const verdictStatus = statusFromVerdict(attempt.verdict, attempt.reportedAt != null && attempt.settledAt == null && attempt.endState == null, attempt.ui);
  const settle = settleView(attempt);
  const nextAttempt = attempt.retry.next;
  return <section id="attempt-step-verdict" className="min-w-0 scroll-mt-24 border-t pt-6" data-tone={statusTone[verdictStatus]}>
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <Gavel className="size-4 text-muted-foreground" aria-hidden="true" />
      <h3 className="m-0 text-sm font-medium">{t('Recorded runtime verdict')}</h3>
      <StatusChip status={verdictStatus} label={verdictChipLabel(verdictStatus, attempt.verdict)} />
      {attempt.settledBy ? <span className="text-xs text-muted-foreground">{t('by {actor}', { actor: attempt.settledBy })}</span> : null}
      {attempt.settledAt != null ? <span className="text-xs text-muted-foreground">{formatAbsolute(attempt.settledAt)}</span> : null}
    </div>
    <p className="mb-4 mt-0 text-xs text-muted-foreground">{t('The runtime verdict comes from Attempt settlement. Checkpoint, workflow integration and product reads have separate receipts.')}</p>
    {attempt.why ? <WhyExplanation why={attempt.why} /> : null}
    <SettleReasons attempt={attempt} settle={settle} />
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4 text-sm">
      <span className="text-muted-foreground">{t('Next step:')}</span>
      <span className="min-w-0 break-words">{settle.nextStep ?? t('No next step recorded yet.')}</span>
      {nextAttempt ? <Link href={nextAttempt.href} className="gap-1 font-medium">{t('Next attempt #{id}', { id: nextAttempt.id })}<ArrowRight className="size-3.5" aria-hidden="true" /></Link> : null}
    </div>
  </section>;
}

function DeclarationsSection({ manifest, report }: Readonly<{ manifest: AttemptManifest | null; report: Record<string, unknown> | null }>) {
  const hasClaims = report?.claims != null;
  if (manifest == null && !hasClaims) return null;
  const declarationsSummary = [manifest ? t('{n} Op-declared assertions', { n: manifest.assertions.length }) : null, hasClaims ? t('Exact reported claims') : null].filter(Boolean).join(' · ');
  return <Advanced summary={declarationsSummary || undefined}>
    <div className="grid min-w-0 gap-6">
      {manifest ? <Assertions manifest={manifest} /> : null}
      {hasClaims ? <section className="min-w-0">
        <h3 className="m-0 mb-1 text-sm font-medium">{t('Exact reported claims')}</h3>
        <p className="mb-3 mt-0 text-xs text-muted-foreground">{t('Submitted claims are declarations; they do not establish requirement completion.')}</p>
        <TextView text={jsonText(report?.claims)} query="" />
      </section> : null}
    </div>
  </Advanced>;
}

/** Independent report, runtime checks, checkpoint and verdict facts for one dispatch. */
export function ResultCard({ attempt, onShowChecks }: Readonly<{ attempt: AttemptDetailV3; onShowChecks?: () => void }>) {
  const report = obj(attempt.report?.json);
  const summary = text(report?.summary) ?? attempt.summary;
  const manifestState = attempt.manifestRead?.state;
  return <Card id="attempt-result" concept="C10" title={t('Outcome')} hint={t('Op declarations, runtime checks, checkpoint and verdict')}>
    <div className="grid min-w-0 gap-6">
      <OpReportSection attempt={attempt} report={report} summary={summary} />
      <RuntimeChecksSection attempt={attempt} onShowChecks={onShowChecks} />

      <CheckpointReceipt attempt={attempt} />

      <VerdictSection attempt={attempt} />

      {manifestState === 'unavailable' || manifestState === 'invalid' ? <FeedbackState error onRetry={() => refreshQuery(`/api/attempts/${encodeURIComponent(attempt.project)}/${attempt.id}`)}>{t('The submitted manifest could not be read; its criteria are unknown.')} · {manifestState}</FeedbackState> : null}

      <DeclarationsSection manifest={manifestOf(attempt)} report={report} />
    </div>
  </Card>;
}
