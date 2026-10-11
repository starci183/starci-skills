import { Meter } from '@heroui/react';
import { unitStateLabels } from '../i18n/vi';
import { t } from '../i18n/t';
import { Button } from './ui/button';
import { FeedbackState } from './feedback-state';
import type { Concept } from './concept';

export const concept: Concept = 'C4';

export const unitStates = ['planned', 'queued', 'running', 'reported', 'deciding', 'done', 'failed', 'dropped'] as const;
export type UnitState = (typeof unitStates)[number];

/** A distribution of units by current state, never a sequential workflow timeline. */
export function LifecycleBar({ counts, onSelect, selected }: Readonly<{
  counts: Partial<Record<UnitState, number>>;
  selected?: UnitState | null;
  onSelect?: (state: UnitState) => void;
}>) {
  const total = unitStates.reduce((sum, state) => sum + Math.max(0, counts[state] ?? 0), 0);
  if (total === 0) return <FeedbackState>{t('No units in the graph yet.')}</FeedbackState>;
  const distribution = unitStates.map(state => `${unitStateLabels[state]} ${counts[state] ?? 0}`).join(', ');
  return <div className="lifecycle" data-concept="C4">
    <Meter value={total} maxValue={total} aria-label={distribution} valueLabel={distribution}>
      <Meter.Track className="lifecycle-track gap-px">
        {unitStates.filter((state) => (counts[state] ?? 0) > 0).map((state) => <Meter.Fill key={state} data-unit-state={state} style={{ flex: counts[state], position: 'relative' }} />)}
      </Meter.Track>
    </Meter>
    <div className="lifecycle-legend">
      {unitStates.filter((state) => (counts[state] ?? 0) > 0).map((state) => {
        const content = <><span className="lifecycle-swatch" data-unit-state={state} aria-hidden="true" />{unitStateLabels[state]} <strong>{counts[state]}</strong></>;
        return onSelect
          ? <Button key={state} variant="ghost" size="sm" className="lifecycle-label" aria-pressed={selected === state} onClick={() => onSelect(state)}>{content}</Button>
          : <span key={state} className="lifecycle-label">{content}</span>;
      })}
    </div>
  </div>;
}
