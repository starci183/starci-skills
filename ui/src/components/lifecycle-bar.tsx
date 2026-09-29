import { motion } from 'motion/react';
import { unitStateLabels } from '../i18n/vi';
import { EASE } from './motion';
import type { Concept } from './concept';

export const concept: Concept = 'C4';

export const unitStates = ['planned', 'queued', 'running', 'reported', 'deciding', 'done', 'failed', 'dropped'] as const;
export type UnitState = (typeof unitStates)[number];

/** A distribution of units by current state, never a sequential workflow timeline. */
export function LifecycleBar({ counts, onSelect, selected }: {
  counts: Partial<Record<UnitState, number>>;
  selected?: UnitState | null;
  onSelect?: (state: UnitState) => void;
}) {
  const total = unitStates.reduce((sum, state) => sum + Math.max(0, counts[state] ?? 0), 0);
  if (total === 0) return <div className="empty-state">Chưa có đơn vị trong đồ thị.</div>;
  return <div className="lifecycle" data-concept="C4">
    <div className="lifecycle-track" role="img" aria-label={unitStates.map((state) => `${unitStateLabels[state]} ${counts[state] ?? 0}`).join(', ')}>
      {unitStates.filter((state) => (counts[state] ?? 0) > 0).map((state) => <motion.span key={state} data-unit-state={state} style={{ width: `${100 * (counts[state] ?? 0) / total}%`, transformOrigin: 'left center' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.36, ease: EASE }} />)}
    </div>
    <div className="lifecycle-legend">
      {unitStates.filter((state) => (counts[state] ?? 0) > 0).map((state) => {
        const content = <><span className="lifecycle-swatch" data-unit-state={state} aria-hidden="true" />{unitStateLabels[state]} <strong>{counts[state]}</strong></>;
        return onSelect
          ? <button type="button" key={state} className="lifecycle-label" aria-pressed={selected === state} onClick={() => onSelect(state)}>{content}</button>
          : <span key={state} className="lifecycle-label">{content}</span>;
      })}
    </div>
  </div>;
}
