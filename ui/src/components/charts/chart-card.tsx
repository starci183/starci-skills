import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { DURATION, EASE } from '../motion';
import { toneVar, type Tone } from '../status';

export type LegendItem = { tone?: Tone; label: string; hollow?: boolean; neutral?: boolean };

export function Legend({ items }: { items: LegendItem[] }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Chú giải">
    {items.map(item => <li key={item.label} className="inline-flex items-center gap-2">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        {item.hollow
          ? <circle cx="6" cy="6" r="4.5" fill="none" stroke={toneVar(item.tone ?? 'running')} strokeWidth="1.75" />
          : <rect x="1" y="1" width="10" height="10" rx="2.5" fill={item.tone ? toneVar(item.tone) : item.neutral ? 'var(--primary)' : 'var(--muted-foreground)'} />}
      </svg>{item.label}</li>)}
  </ul>;
}

/** One analytics chart: title, one-line explanation, legend, body or empty state. */
export function ChartCard({ title, hint, legend, empty, className = '', children }: { title: string; hint: string; legend?: LegendItem[];
  empty?: string | false; className?: string; children?: ReactNode }) {
  return <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.enter, ease: EASE }} className={`min-w-0 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 min-[760px]:p-6 ${className}`} aria-label={title}>
    <h2 className="text-base font-semibold">{title}</h2>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    {legend && !empty ? <div className="mt-2"><Legend items={legend} /></div> : null}
    <div className="mt-4 min-w-0">{empty ? <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{empty}</p> : children}</div>
  </motion.section>;
}
