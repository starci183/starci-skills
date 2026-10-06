import type { AdmissionReservation, AttemptDetailV2 } from '../../contract';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { CopyId, InfoChip, InfoRow } from '../infra/rows';
import type { Concept } from '../concept';
import { jsonText } from './frame/util';

export const concept: Concept = 'C6';

function ReceiptRows({ receipt, historical }: Readonly<{ receipt: AdmissionReservation | null; historical: boolean }>) {
  if (!receipt) return <p className="m-0 text-sm text-muted-foreground">{historical ? t('No admission receipt was captured for this dispatch.') : t('No current receipt matches the captured binding.')}</p>;
  const quota = receipt.quota;
  return <dl className="m-0">
    <InfoRow label={t('Receipt binding')}><CopyId value={receipt.id} /><span className="mt-1 block text-xs text-muted-foreground">{t('fence {fence} · attempt {id}', { fence: receipt.fence, id: receipt.attemptId })}</span></InfoRow>
    <InfoRow label={t('Provider / account')}>{receipt.provider} · <span className="break-all font-mono text-xs">{receipt.account}</span></InfoRow>
    <InfoRow label={t('Bound model / role')}>{receipt.model} · {receipt.role}</InfoRow>
    <InfoRow label={t('Reservation state')}><InfoChip tone={receipt.state === 'unknown' ? 'warning' : receipt.state === 'released' ? 'skipped' : undefined}>{receipt.state}</InfoChip><span className="mt-1 block text-xs text-muted-foreground">{formatAbsolute(receipt.updatedAt)}</span></InfoRow>
    <InfoRow label={historical ? t('Reserved slots at dispatch') : t('Slots held by this receipt')}>{historical || receipt.state !== 'released' ? receipt.slots : 0}<span className="text-xs text-muted-foreground"> · {t('recorded cap {cap}', { cap: receipt.maxParallel })}</span>{receipt.state === 'unknown' ? <span className="mt-1 block text-xs text-muted-foreground">{t('Unknown reservations still occupy their slots.')}</span> : null}</InfoRow>
    {historical ? <InfoRow label={t('Quota at dispatch')}>{quota ? <span className="flex flex-col gap-1"><span>{quota.auth} · {quota.state} · {quota.fresh === true ? t('fresh when captured') : quota.fresh === false ? t('stale when captured') : t('freshness not recorded')}</span><span className="text-xs text-muted-foreground">{t('Observed at')} {formatAbsolute(quota.observedAt)}{quota.usedPercent != null ? ` · ${quota.usedPercent}%` : ''}</span><span className="text-xs text-muted-foreground">{t('Historical observation; current eligibility is not established.')}</span></span> : <span className="text-muted-foreground">{t('Not recorded')}</span>}</InfoRow> : null}
  </dl>;
}

/** Captured admission data and the API's exact fenced match are separate observations. */
export function AdmissionDetails({ attempt }: Readonly<{ attempt: AttemptDetailV2 }>) {
  const admission = attempt.admission;
  const captured = admission?.source === 'contract';
  return <section className="mt-3 border-t border-border pt-3">
    <h4 className="m-0 mb-2 text-[13px] font-semibold">{t('Admission at dispatch')}</h4>
    <p className="mb-3 mt-0 text-xs text-muted-foreground">{captured ? <>{t('Captured dispatch contract')} · {formatAbsolute(admission.recordedAt)}</> : t('No admission capture was recorded.')}</p>
    <div className="grid gap-6 lg:grid-cols-2">
      <section><h5 className="mb-2 mt-0 text-xs font-semibold text-muted-foreground">{t('Captured receipt')}</h5><ReceiptRows receipt={admission?.capturedReceipt ?? null} historical /></section>
      <section><h5 className="mb-2 mt-0 text-xs font-semibold text-muted-foreground">{t('Current matching receipt')}</h5>{admission?.observed ? <ReceiptRows receipt={admission.receipt} historical={false} /> : <p className="m-0 text-sm text-muted-foreground">{t('Current admission table was not observed.')}</p>}</section>
    </div>
    {captured ? <details className="mt-3"><summary className="cursor-pointer text-xs font-medium">{t('Recorded routing and admission proof')}</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 font-mono text-xs">{jsonText({ selection: admission.selection, capturedReceipt: admission.capturedReceipt, currentReceipt: admission.receipt })}</pre></details> : null}
  </section>;
}
