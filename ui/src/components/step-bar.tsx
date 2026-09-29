import { Check, Circle, CircleAlert } from 'lucide-react';
import type { UiState } from '../contract';
import { stepLabels } from '../i18n/vi';
import type { AttemptStep } from '../router';
import { motion } from 'motion/react';
import { EASE, Grow } from './motion';
import type { Concept } from './concept';
import type { Tone } from './status';

export const concept: Concept = 'C7';

/** `tone` (semantic) wins over `state`; `segments` draws a mini bar (e.g. checks 2 pass / 1 fail). */
export type StepItem = { key: AttemptStep; state: UiState; at: number | null; detail?: string; tone?: Tone; segments?: { tone: Tone; n: number }[] };

export function StepBar({ steps, selected, onSelect }: { steps: StepItem[]; selected: AttemptStep; onSelect: (step: AttemptStep) => void }) {
  return <nav className="step-bar" aria-label="Vòng đời lần thử" data-concept="C7">
    {steps.map((step, index) => {
      const Icon = step.state === 'bad' || step.tone === 'failed' ? CircleAlert : step.state === 'done' || step.state === 'ok' || step.tone === 'success' ? Check : Circle;
      return <button key={step.key} type="button" className="step-item" data-state={step.state} data-tone={step.tone} aria-current={selected === step.key ? 'step' : undefined}
        onClick={() => onSelect(step.key)}>
        <span className="step-marker"><Icon className="size-3.5" aria-hidden="true" /></span>
        <span className="step-copy"><strong>{stepLabels[step.key]}</strong><small>{step.detail ?? (step.at ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(step.at) : 'Chưa có mốc')}</small>
          {step.segments?.length ? <span className="step-segments" aria-hidden="true">{step.segments.filter(s => s.n > 0).map((s, i) => <motion.span key={i} data-tone={s.tone} style={{ flex: s.n, transformOrigin: 'left center' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.36, ease: EASE, delay: index * 0.05 + i * 0.04 }} />)}</span> : null}
        </span>
        <Grow className="step-stripe" delay={index * 0.05} />
        <span className="sr-only">Bước {index + 1}</span>
      </button>;
    })}
  </nav>;
}
