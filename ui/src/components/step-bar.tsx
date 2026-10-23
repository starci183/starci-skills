import { Check, Circle, CircleAlert } from 'lucide-react';
import { Meter } from '@heroui/react';
import type { CSSProperties } from 'react';
import type { UiState } from '../contract';
import { stateLabels, stepLabels } from '../i18n/vi';
import type { AttemptStep } from '../router';
import { Grow } from './motion';
import { Button } from './ui/button';
import type { Concept } from './concept';
import type { Tone } from './status';
import { t } from '../i18n/t';

/** The business concept id (C7) under which the attempt milestone bar is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C7';

/** `tone` (semantic) wins over `state`; `segments` draws a mini bar (e.g. checks 2 pass / 1 fail). */
export type StepItem = { key: AttemptStep; state: UiState; at: number | null; detail?: string; tone?: Tone; segments?: { tone: Tone; n: number }[] };

/** The icon of a milestone: an alert when it failed, a check when it succeeded, otherwise an empty circle. */
const stepIcon = (step: StepItem) => {
  if (step.state === 'bad' || step.tone === 'failed') return CircleAlert;
  if (step.state === 'done' || step.state === 'ok' || step.tone === 'success') return Check;
  return Circle;
};

/** A mini-bar segment sized in proportion to its count; the tone colour comes from the segment's data-tone. */
const segmentStyle = (count: number): CSSProperties => ({ flex: count, position: 'relative', background: 'var(--tone)' });

/** The row of attempt milestones (dispatch to land), each showing its state, time or detail, and optional pass/fail mini-bar. */
export const StepBar = ({ steps, selected, onSelect }: Readonly<{ steps: StepItem[]; selected: AttemptStep; onSelect: (step: AttemptStep) => void }>) => {
  const style: CSSProperties & { '--step-count': number } = { '--step-count': Math.max(steps.length, 1) };
  return <div className="step-bar-frame"><nav className="step-bar" style={style} aria-label={t('Recorded attempt milestones')} data-concept="C7">
    {steps.map((step, index) => {
      const Icon = stepIcon(step);
      const segments = step.segments?.filter(segment => segment.n > 0) ?? [];
      const segmentTotal = segments.reduce((sum, segment) => sum + segment.n, 0);
      return <Button key={step.key} variant="ghost" className="step-item h-auto w-full justify-start whitespace-normal" data-state={step.state} data-tone={step.tone} {...(selected === step.key ? { 'aria-current': 'location' as const } : {})}
        onClick={() => onSelect(step.key)}>
        <span className="step-marker"><Icon className="size-3.5" aria-hidden="true" /></span>
        <div className="step-copy"><strong>{stepLabels[step.key]}</strong><small>{step.detail ?? (step.at ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(step.at) : t('No mark yet'))}</small>
          {segments.length ? <Meter value={segmentTotal} maxValue={segmentTotal} size="sm" aria-label={stepLabels[step.key]} aria-hidden="true">
            <Meter.Track className="step-segments">{segments.map(segment => <Meter.Fill key={segment.tone} data-tone={segment.tone} className="h-full min-w-1 rounded-full" style={segmentStyle(segment.n)} />)}</Meter.Track>
          </Meter> : null}
        </div>
        <Grow className="step-stripe" delay={index * 0.05} />
        <span className="sr-only">{stateLabels[step.state]}</span>
      </Button>;
    })}
  </nav></div>;
};
