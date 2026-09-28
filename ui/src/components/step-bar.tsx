import { Check, Circle, CircleAlert } from 'lucide-react';
import type { UiState } from '../contract';
import { stepLabels } from '../i18n/vi';
import type { AttemptStep } from '../router';
import type { Concept } from './concept';

export const concept: Concept = 'C7';

export type StepItem = { key: AttemptStep; state: UiState; at: number | null; detail?: string };

export function StepBar({ steps, selected, onSelect }: { steps: StepItem[]; selected: AttemptStep; onSelect: (step: AttemptStep) => void }) {
  return <nav className="step-bar" aria-label="Vòng đời lần thử" data-concept="C7">
    {steps.map((step, index) => {
      const Icon = step.state === 'bad' ? CircleAlert : step.state === 'done' || step.state === 'ok' ? Check : Circle;
      return <button key={step.key} type="button" className="step-item" data-state={step.state} aria-current={selected === step.key ? 'step' : undefined}
        onClick={() => onSelect(step.key)}>
        <span className="step-marker"><Icon className="size-3.5" aria-hidden="true" /></span>
        <span className="step-copy"><strong>{stepLabels[step.key]}</strong><small>{step.detail ?? (step.at ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(step.at) : 'Chưa có mốc')}</small></span>
        <span className="sr-only">Bước {index + 1}</span>
      </button>;
    })}
  </nav>;
}
