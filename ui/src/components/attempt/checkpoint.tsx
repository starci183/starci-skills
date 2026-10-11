import type { AttemptDetailV2, RuntimeCheckpoint } from '../../contract';
import { Alert } from '@heroui/react';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';
import { ShaId } from '../infra/rows';
import { StatusChip } from '../status-chip';
import type { Status } from '../status';
import type { Concept } from '../concept';
import { Advanced } from '../motion';

export const concept: Concept = 'C11';

/** The report's valid tested Git identity; checkout HEAD and checkpoint are separate facts. */
export function reportTestedHead(attempt: Pick<AttemptDetailV2, 'report'>): string | null {
  const report = attempt.report?.json;
  return report && typeof report === 'object' && !Array.isArray(report) && 'head' in report && typeof report.head === 'string' && /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i.test(report.head) ? report.head : null;
}

/** Describe the recorded commit action only; a missing receipt remains unconfirmed. */
export function checkpointState(checkpoint: RuntimeCheckpoint | null): { status: Status; label: string } {
  if (!checkpoint) return { status: 'unknown', label: t('Checkpoint receipt not confirmed') };
  if (checkpoint.committed === true) return { status: 'success', label: t('New runtime commit') };
  if (checkpoint.committed === false) return { status: 'success', label: t('No new commit; recorded SHA reused') };
  return { status: 'unknown', label: t('Commit action not recorded') };
}

/** Show the Attempt-bound checkpoint and report-tested identity independently of settlement or integration. */
export function CheckpointReceipt({ attempt }: Readonly<{ attempt: AttemptDetailV2 }>) {
  const checkpoint = attempt.checkpoint;
  const state = checkpointState(checkpoint);
  const tested = reportTestedHead(attempt);
  const different = Boolean(checkpoint && tested && checkpoint.sha.toLowerCase() !== tested.toLowerCase());
  return <section id="attempt-step-commit" data-concept={concept} className="min-w-0 scroll-mt-24 border-t pt-6" aria-labelledby="attempt-checkpoint-heading">
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <h3 id="attempt-checkpoint-heading" className="m-0 text-sm font-medium">{t('Runtime checkpoint')}</h3>
      <span className="text-xs text-muted-foreground">{t('Recorded commit action')}</span>
      <StatusChip status={state.status} label={state.label} />
    </div>
    {checkpoint ? <p className="mb-3 mt-0 text-xs text-muted-foreground">{t('Checkpoint receipt recorded for this Attempt.')}</p> : null}
    <dl className="m-0 grid gap-3 text-sm sm:grid-cols-2">
      <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t('Checkpoint SHA')}</dt><dd className="m-0 mt-1"><ShaId sha={checkpoint?.sha} /></dd></div>
      <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t('Checkpoint recorded at')}</dt><dd className="m-0 mt-1">{checkpoint ? formatAbsolute(checkpoint.at) : t('Not recorded')}</dd></div>
      <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t('HEAD tested by the Op')}</dt><dd className="m-0 mt-1"><ShaId sha={tested} /></dd></div>
      <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t('Checkpoint file count')}</dt><dd className="m-0 mt-1">{checkpoint?.files == null ? t('Not recorded') : t('{n} files', { n: checkpoint.files.length })}</dd></div>
    </dl>
    {different ? <Alert status="warning" className="mt-4"><Alert.Content><Alert.Description className="break-words">{t('The Op-tested HEAD differs from the recorded checkpoint SHA.')}</Alert.Description></Alert.Content></Alert> : null}
    <p className="mb-0 mt-3 text-xs text-muted-foreground">{checkpoint ? t('This receipt records a workflow-branch checkpoint; workflow integration, push and deployment require their own receipts.') : t('The verdict does not establish a checkpoint receipt.')}</p>
    {checkpoint ? <Advanced className="mt-4" title={t('Checkpoint scope & files')} keepMounted>
      <dl className="m-0 grid min-w-0 gap-6 text-sm sm:grid-cols-2">
        {[{ label: t('Recorded owned paths'), value: checkpoint.scope }, { label: t('Files recorded by the checkpoint'), value: checkpoint.files }].map(({ label, value }) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="m-0 mt-2">{value == null ? t('Not recorded') : value.length ? <ul className="m-0 grid list-none gap-2 p-0">{value.map((file, index) => <li key={`${index}:${file}`} className="break-all font-mono text-xs leading-5">{file}</li>)}</ul> : t('Recorded empty list')}</dd></div>)}
      </dl>
    </Advanced> : null}
  </section>;
}
