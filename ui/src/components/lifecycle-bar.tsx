import type { CSSProperties } from 'react';
import { Meter } from '@heroui/react';
import { unitStateLabels } from '../i18n/vi';
import { t } from '../i18n/t';
import { Button } from './ui/button';
import { FeedbackState } from './feedback-state';
import type { Concept } from './concept';

/** The business concept id (C4) under which the unit lifecycle distribution is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C4';

/** Every state a unit of work can be in, in lifecycle order, used to order the bar and its legend. */
export const unitStates = ['planned', 'queued', 'running', 'reported', 'deciding', 'done', 'failed', 'dropped'] as const;
/** One state of the unit lifecycle. */
export type UnitState = (typeof unitStates)[number];

/** A distribution of units by current state, never a sequential workflow timeline. */
export const LifecycleBar = ({ counts, onSelect, selected }: Readonly<{
  counts: Partial<Record<UnitState, number>>;
  selected?: UnitState | null;
  onSelect?: (state: UnitState) => void;
}>) => {
  const total = unitStates.reduce((sum, state) => sum + Math.max(0, counts[state] ?? 0), 0);
  if (total === 0) return <FeedbackState>{t('No units in the graph yet.')}</FeedbackState>;
  const distribution = unitStates.map(state => `${unitStateLabels[state]} ${counts[state] ?? 0}`).join(', ');
  const segments = unitStates.flatMap(state => {
    const count = counts[state] ?? 0;
    const style: CSSProperties = { flex: count, position: 'relative' };
    return count > 0 ? [{ state, count, style }] : [];
  });
  return <div className="lifecycle" data-concept="C4">
    <Meter value={total} maxValue={total} aria-label={distribution} valueLabel={distribution}>
      <Meter.Track className="lifecycle-track gap-px">
        {segments.map(({ state, style }) => <Meter.Fill key={state} data-unit-state={state} style={style} />)}
      </Meter.Track>
    </Meter>
    <div className="lifecycle-legend">
      {segments.map(({ state, count }) => {
        const content = <><span className="lifecycle-swatch" data-unit-state={state} aria-hidden="true" />{unitStateLabels[state]} <strong>{count}</strong></>;
        return onSelect
          ? <Button key={state} variant="ghost" size="sm" className="lifecycle-label" aria-pressed={selected === state} onClick={() => onSelect(state)}>{content}</Button>
          : <span key={state} className="lifecycle-label">{content}</span>;
      })}
    </div>
  </div>;
};
