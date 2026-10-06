import { CircleAlert, CircleHelp, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './ui/button';
import type { Concept } from './concept';
import { t } from '../i18n/t';

export const concept: Concept = 'frame';

/** One quiet pattern for a missing result or a failed read. */
export function FeedbackState({ children, error = false, onRetry }: Readonly<{ children: ReactNode; error?: boolean; onRetry?: () => void }>) {
  const Icon = error ? CircleAlert : CircleHelp;
  return <div className="feedback-state" data-feedback={error ? 'error' : 'empty'} role={error ? 'alert' : 'status'}>
    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
    <span>{children}</span>
    {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RotateCw size={14} strokeWidth={1.75} aria-hidden="true" /> {t('Retry')}</Button>}
  </div>;
}

/** Static geometry matching a page heading and its first data region. */
export function PageSkeleton({ label = t('Loading page…') }: Readonly<{ label?: string }>) {
  return <output className="page-skeleton" aria-label={label}>
    <span className="sr-only">{label}</span>
    <span className="skeleton-line skeleton-title block" /><span className="skeleton-line skeleton-subtitle block" />
    <span className="skeleton-panel"><span className="skeleton-line skeleton-row" /><span className="skeleton-line skeleton-row" /><span className="skeleton-line skeleton-row" /></span>
  </output>;
}
