import { Badge } from './ui/badge';
import { Check, CircleAlert, CircleCheck, CircleDot, CircleHelp, Clock3, TriangleAlert } from 'lucide-react';
import type { UiState } from '../contract';
import { stateLabels } from '../i18n/vi';
import type { Concept } from './concept';
import { StatusChip } from './status-chip';

export const concept: Concept = 'frame';

const icons = {
  bad: CircleAlert,
  warn: TriangleAlert,
  running: CircleDot,
  waiting: Clock3,
  ok: CircleCheck,
  done: Check,
  unknown: CircleHelp,
} satisfies Record<UiState, typeof Check>;

/** v_op_history.ui also carries the attempt-only states 'awaiting-owner' and 'rejected' (docs/why.md). */
export type AnyUiState = UiState | 'awaiting-owner' | 'rejected';

export function StateChip({ state, label, compact = false }: { state: AnyUiState; label?: string; compact?: boolean }) {
  if (state === 'awaiting-owner' || state === 'rejected') return <StatusChip status={state} label={compact ? <span className="sr-only">{label}</span> : label} />;
  const known: UiState = state in icons ? state : 'unknown';
  const Icon = icons[known];
  return <Badge variant="outline" data-state={known} className="st-chip">
    <Icon aria-hidden="true" className="size-3" />
    {compact ? <span className="sr-only">{label ?? stateLabels[known]}</span> : <span>{label ?? stateLabels[known]}</span>}
  </Badge>;
}
