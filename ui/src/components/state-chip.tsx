import { Badge } from './ui/badge';
import { Check, CircleAlert, CircleCheck, CircleDot, CircleHelp, Clock3, TriangleAlert } from 'lucide-react';
import type { UiState } from '../contract';
import { stateLabels } from '../i18n/vi';
import type { Concept } from './concept';

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

export function StateChip({ state, label, compact = false }: { state: UiState; label?: string; compact?: boolean }) {
  const Icon = icons[state];
  return <Badge variant="outline" data-state={state} className="st-chip">
    <Icon aria-hidden="true" className="size-3" />
    {compact ? <span className="sr-only">{label ?? stateLabels[state]}</span> : <span>{label ?? stateLabels[state]}</span>}
  </Badge>;
}
