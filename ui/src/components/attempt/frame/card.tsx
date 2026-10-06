import { createContext, useContext, type ReactNode } from 'react';
import { ConceptBlock, type Concept } from '../../concept';
import { FeedbackState } from '../../feedback-state';
import { Card as Surface, CardContent, CardHeader } from '../../ui/card';

export const concept: Concept = 'frame';

/** Inside an `<Advanced variant="card">` the section already has a frame and a title: cards render bare (a slim hint/right row, then the body). */
const BareContext = createContext(false);
export const BareCards = BareContext.Provider;

/** Section card used by every block of the attempt page: title, hint on the right, body. */
export function Card({ id, title, hint, right, concept: c, children, className = '' }: { readonly id?: string; readonly title: ReactNode; readonly hint?: ReactNode; readonly right?: ReactNode; readonly concept: Concept; readonly children: ReactNode; readonly className?: string }) {
  const bare = useContext(BareContext);
  if (bare) {
    return <ConceptBlock concept={c} as="section" aria-label={typeof title === 'string' ? title : undefined} className={`flex min-w-0 flex-col gap-4 ${className}`}>
      {hint || right ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {hint ? <span className="min-w-0 text-xs text-muted-foreground">{hint}</span> : null}
        {right ? <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div> : null}
      </div> : null}
      <div className="min-w-0">{children}</div>
    </ConceptBlock>;
  }
  return <ConceptBlock concept={c} as="section" id={id} className={`min-w-0 scroll-mt-4 ${className}`}>
    <Surface className="min-w-0 shadow-none [--card-spacing:--spacing(4)] min-[760px]:[--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1 border-b">
        <h2 className="m-0 font-semibold">{title}</h2>
        {hint ? <span className="min-w-0 text-xs text-muted-foreground">{hint}</span> : null}
        {right ? <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div> : null}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Surface>
  </ConceptBlock>;
}

export function Empty({ children }: { readonly children: ReactNode }) {
  return <FeedbackState>{children}</FeedbackState>;
}
