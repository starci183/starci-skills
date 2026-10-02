import type { MiniPipeline } from '../../contract';
import { statusLabels, statusTone, type Status } from '../status';
import { motion } from 'motion/react';
import { DURATION, EASE } from '../motion';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';

export const concept: Concept = 'C2';

/** Mini pipeline: one dot per leg in chain order. Current leg is ringed; deferred/external are dashed. */
export function PipelineDots({ pipeline }: { pipeline: MiniPipeline }) {
  return <ol className="flex flex-wrap items-center gap-2" aria-label={t("The workflow's leg chain")}>
    {pipeline.legs.map((leg, index) => {
      const status = leg.status as Status;
      const dashed = status === 'deferred' || status === 'external' || status === 'dropped';
      const hollow = status === 'planned' || status === 'queued';
      const tip = `${leg.op}: ${statusLabels[status] ?? status}${leg.tries > 0 ? t(' · try {n}/5', { n: leg.tries }) : ''}${leg.units > 1 ? t(' · {n} units', { n: leg.units }) : ''}`;
      return <motion.li key={`${leg.op}-${index}`} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ duration: DURATION.base, ease: EASE, delay: Math.min(index * 0.02, 0.4) }} data-tone={statusTone[status] ?? 'queued'} title={tip} aria-label={tip}
        className={`size-3.5 rounded-full border-2 ${dashed ? 'border-dashed bg-transparent' : hollow ? 'bg-transparent' : 'bg-[var(--tone)]'} ${leg.current ? 'outline outline-2 outline-offset-2 outline-[var(--tone)]' : ''}`}
        style={{ borderColor: 'var(--tone)' }} />;
    })}
    {pipeline.legs.length === 0 && <li className="text-xs text-muted-foreground">{t('No legs yet')}</li>}
  </ol>;
}
