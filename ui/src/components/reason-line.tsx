import { Info } from 'lucide-react';
import type { Reason } from '../contract';
import { formatReason } from '../i18n/vi';
import type { Concept } from './concept';

export const concept: Concept = 'frame';

export function ReasonLine({ reason, prefix = 'Vì sao', className = '' }: { reason: Reason | null | undefined; prefix?: string; className?: string }) {
  return <div className={`reason-line ${className}`}>
    <Info aria-hidden="true" className="size-3.5 shrink-0" />
    <span><strong>{prefix}:</strong> {formatReason(reason)}</span>
    {reason?.raw && <span className="sr-only">Nguyên văn: {reason.raw}</span>}
  </div>;
}
