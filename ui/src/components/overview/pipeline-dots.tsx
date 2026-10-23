import type { ContractInfo, MiniPipeline } from '../../contract';
import { statusLabels, statusTone } from '../status';
import { motion } from 'motion/react';
import type { Status } from '../status';
import { DURATION, EASE } from '../motion';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';
import { formatOpLabel } from '../../i18n/vi';

/** Names the C2 overview concept this module belongs to, for the mini pipeline dots. */
export const concept: Concept = 'C2';

type LegTryInput = { tries: number | null; tryBudget?: number | null; units?: number | null };
type OpLabels = ContractInfo['opLabels'];
type PipelineDotsProps = Readonly<{ pipeline: MiniPipeline; opLabels?: OpLabels | undefined }>;

const DOT_FROM = { scale: 0.4 };
const DOT_TO = { scale: 1 };
const DOT_STYLE = { borderColor: 'var(--tone)' };
const DASHED: ReadonlySet<Status> = new Set<Status>(['deferred', 'external', 'dropped']);
const HOLLOW: ReadonlySet<Status> = new Set<Status>(['planned', 'queued', 'unknown']);

/** Entrance transition of the dot at `index`: later legs appear a little later, capped so a long chain stays quick. */
const dotTransition = (index: number) => ({ duration: DURATION.base, ease: EASE, delay: Math.min(index * 0.02, 0.4) });

/** Fill style of a leg dot: dashed when excluded from the plan count, hollow while waiting, solid in its tone otherwise; ringed when current. */
const dotClass = (status: Status, current: boolean): string => {
  let fill = 'bg-[var(--tone)]';
  if (DASHED.has(status)) fill = 'border-dashed bg-transparent';
  else if (HOLLOW.has(status)) fill = 'bg-transparent';
  return `size-3.5 rounded-full border-2 ${fill} ${current ? 'outline outline-2 outline-offset-2 outline-[var(--tone)]' : ''}`;
};

/** Describes which try a leg is on, and its recorded unit budget when one exists, without inventing a count that was not observed. */
export const legTry = (leg: LegTryInput): string => {
  if (leg.tries == null || !Number.isFinite(leg.tries)) return t('Try ordinal not observed.');
  const ordinal = leg.units != null && leg.units > 1 ? t('highest try ordinal {n}', { n: leg.tries }) : t('try ordinal {n}', { n: leg.tries });
  return leg.tryBudget != null && Number.isInteger(leg.tryBudget) && leg.tryBudget > 0
    ? `${ordinal} · ${t('recorded unit budget {budget}', { budget: leg.tryBudget })}`
    : ordinal;
};

/** Mini pipeline: one dot per leg in chain order. Current leg is ringed; deferred/external are dashed. */
export const PipelineDots = ({ pipeline, opLabels }: PipelineDotsProps) => {
  const legs = pipeline.legs.filter(leg => leg.inPlan);
  return <ol className="flex flex-wrap items-center gap-2" aria-label={t("The workflow's leg chain")}>
    {legs.map((leg, index) => {
      const status = leg.status;
      const binding = leg.binding === 'unbound' ? t('Planner instance binding has not been recorded.') : t('Recorded units for goal revision {n}', { n: leg.goalRevision ?? '—' });
      const name = formatOpLabel(leg.op, opLabels);
      const alias = name === leg.op ? '' : ` (${leg.op})`;
      const triesNote = leg.tries > 0 ? ` · ${legTry(leg)}` : '';
      const unitsNote = leg.units > 1 ? t(' · {n} units', { n: leg.units }) : '';
      const tip = `${name}${alias}: ${statusLabels[status]} · ${binding}${triesNote}${unitsNote}`;
      return <motion.li key={`${leg.op}:${leg.goalRevision ?? 'none'}:${leg.binding}`} initial={DOT_FROM} animate={DOT_TO} transition={dotTransition(index)} data-tone={statusTone[status] ?? 'queued'} title={tip} aria-label={tip}
        className={dotClass(status, leg.current)}
        style={DOT_STYLE} />;
    })}
    {legs.length === 0 && <li className="text-xs text-muted-foreground">{pipeline.progress?.available ? t('No legs yet') : t('The recorded plan has not been observed.')}</li>}
  </ol>;
};
