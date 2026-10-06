import type { ReactNode } from 'react';
import type { Concept } from './concept';

export const concept: Concept = 'frame';

export function KeyVal({ label, value, mono = false }: Readonly<{ label: string; value: ReactNode; mono?: boolean }>) {
  return <div className="key-val"><dt>{label}</dt><dd className={mono ? 'font-mono' : undefined}>{value ?? '—'}</dd></div>;
}
