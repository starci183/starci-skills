import type { MiniPipeline } from '../../contract';
import { statusLabels, statusTone } from '../status';
import { motion } from 'motion/react';
import { DURATION, EASE } from '../motion';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';

export const concept: Concept = 'C2';

export function legTry(leg: { tries: number | null; tryBudget?: number | null; units?: number | null }): string {
  if (leg.tries == null || !Number.isFinite(leg.tries)) return t('Try ordinal not observed.');
  const ordinal = leg.units != null && leg.units > 1 ? t('highest try ordinal {n}', { n: leg.tries }) : t('try ordinal {n}', { n: leg.tries });
  return leg.tryBudget != null && Number.isInteger(leg.tryBudget) && leg.tryBudget > 0
    ? `${ordinal} · ${t('recorded unit budget {budget}', { budget: leg.tryBudget })}`
    : ordinal;
}

/** Mini pipeline: one dot per leg in chain order. Current leg is ringed; deferred/external are dashed. */
export function PipelineDots({ pipeline }: Readonly<{ pipeline: MiniPipeline }>) {
  const legs = pipeline.legs.filter(leg => leg.inPlan);
  return <ol className="flex flex-wrap items-center gap-2" aria-label={t("The workflow's leg chain")}>
    {legs.map((leg, index) => {
      const status = leg.status;
      const dashed = status === 'deferred' || status === 'external' || status === 'dropped';
      const hollow = status === 'planned' || status === 'queued' || status === 'unknown';
      const binding = leg.binding === 'unbound' ? t('Planner instance binding has not been recorded.') : t('Recorded units for goal revision {n}', { n: leg.goalRevision ?? '—' });
      const tip = `${leg.op}: ${statusLabels[status]} · ${binding}${leg.tries > 0 ? ` · ${legTry(leg)}` : ''}${leg.units > 1 ? t(' · {n} units', { n: leg.units }) : ''}`;
      return <motion.li key={`${leg.op}-${index}`} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ duration: DURATION.base, ease: EASE, delay: Math.min(index * 0.02, 0.4) }} data-tone={statusTone[status] ?? 'queued'} title={tip} aria-label={tip}
        className={`size-3.5 rounded-full border-2 ${dashed ? 'border-dashed bg-transparent' : hollow ? 'bg-transparent' : 'bg-[var(--tone)]'} ${leg.current ? 'outline outline-2 outline-offset-2 outline-[var(--tone)]' : ''}`}
        style={{ borderColor: 'var(--tone)' }} />;
    })}
    {legs.length === 0 && <li className="text-xs text-muted-foreground">{pipeline.progress?.available ? t('No legs yet') : t('The recorded plan has not been observed.')}</li>}
  </ol>;
}
