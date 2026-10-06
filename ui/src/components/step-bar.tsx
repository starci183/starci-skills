import { Check, Circle, CircleAlert } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { UiState } from '../contract';
import { stateLabels, stepLabels } from '../i18n/vi';
import type { AttemptStep } from '../router';
import { motion } from 'motion/react';
import { EASE, Grow } from './motion';
import type { Concept } from './concept';
import type { Tone } from './status';
import { t } from '../i18n/t';

export const concept: Concept = 'C7';

/** `tone` (semantic) wins over `state`; `segments` draws a mini bar (e.g. checks 2 pass / 1 fail). */
export type StepItem = { key: AttemptStep; state: UiState; at: number | null; detail?: string; tone?: Tone; segments?: { tone: Tone; n: number }[] };

export function StepBar({ steps, selected, onSelect }: Readonly<{ steps: StepItem[]; selected: AttemptStep; onSelect: (step: AttemptStep) => void }>) {
  const style: CSSProperties & { '--step-count': number } = { '--step-count': Math.max(steps.length, 1) };
  return <div className="step-bar-frame"><nav className="step-bar" style={style} aria-label={t('Recorded attempt milestones')} data-concept="C7">
    {steps.map((step, index) => {
      const Icon = step.state === 'bad' || step.tone === 'failed' ? CircleAlert : step.state === 'done' || step.state === 'ok' || step.tone === 'success' ? Check : Circle;
      return <button key={step.key} type="button" className="step-item" data-state={step.state} data-tone={step.tone} aria-current={selected === step.key ? 'location' : undefined}
        onClick={() => onSelect(step.key)}>
        <span className="step-marker"><Icon className="size-3.5" aria-hidden="true" /></span>
        <span className="step-copy"><strong>{stepLabels[step.key]}</strong><small>{step.detail ?? (step.at ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(step.at) : t('No mark yet'))}</small>
          {step.segments?.length ? <span className="step-segments" aria-hidden="true">{step.segments.filter(s => s.n > 0).map((s, i) => <motion.span key={s.tone} data-tone={s.tone} style={{ flex: s.n, transformOrigin: 'left center' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.24, ease: EASE, delay: index * 0.05 + i * 0.04 }} />)}</span> : null}
        </span>
        <Grow className="step-stripe" delay={index * 0.05} />
        <span className="sr-only">{stateLabels[step.state]}</span>
      </button>;
    })}
  </nav></div>;
}
