import type { ReactNode } from 'react';
import { ConceptBlock, type Concept } from '../../concept';

export const concept: Concept = 'frame';

/** Section card used by every block of the attempt page: title, hint on the right, body. */
export function Card({ id, title, hint, right, concept: c, children, className = '' }: { id?: string; title: ReactNode; hint?: ReactNode; right?: ReactNode; concept: Concept; children: ReactNode; className?: string }) {
  return <ConceptBlock concept={c} as="section" id={id} className={`min-w-0 scroll-mt-4 rounded-xl border bg-card shadow-sm ${className}`}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 sm:px-5">
      <h2 className="font-semibold">{title}</h2>
      {hint ? <span className="min-w-0 text-xs text-muted-foreground">{hint}</span> : null}
      {right ? <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
    <div className="min-w-0 p-4 sm:p-5">{children}</div>
  </ConceptBlock>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{children}</p>;
}
