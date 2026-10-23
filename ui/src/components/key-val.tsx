import type { ReactNode } from 'react';
import type { Concept } from './concept';

/** The business concept id (frame) under which the shared label/value pair is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'frame';

/** One label with its value in a definition list, showing a dash when the value is absent. */
export const KeyVal = ({ label, value, mono = false }: Readonly<{ label: string; value: ReactNode; mono?: boolean }>) => {
  return <div className="key-val"><dt>{label}</dt><dd className={mono ? 'font-mono' : undefined}>{value ?? '—'}</dd></div>;
};
