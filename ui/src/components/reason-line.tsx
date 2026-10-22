import { Info } from 'lucide-react';
import type { Reason } from '../contract';
import { formatReason } from '../i18n/vi';
import type { Concept } from './concept';
import { t } from '../i18n/t';

/** The business concept id (frame) under which the one-line reason is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'frame';

type ReasonLineProps = { readonly reason: Reason | null | undefined; readonly prefix?: string; readonly className?: string };

/** A single line that states the recorded reason code in words, with the verbatim server text kept for screen readers. */
export const ReasonLine = ({ reason, prefix = t('Why'), className = '' }: ReasonLineProps) => {
  return <div className={`reason-line ${className}`}>
    <Info aria-hidden="true" className="size-3.5 shrink-0" />
    <span><strong>{prefix}:</strong> {formatReason(reason)}</span>
    {reason?.raw && <span className="sr-only">{t('Verbatim: {raw}', { raw: reason.raw })}</span>}
  </div>;
};
