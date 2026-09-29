import { CircleAlert, CircleHelp, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './ui/button';
import type { Concept } from './concept';

export const concept: Concept = 'frame';

/** One quiet pattern for a missing result or a failed read. */
export function FeedbackState({ children, error = false, onRetry }: { children: ReactNode; error?: boolean; onRetry?: () => void }) {
  const Icon = error ? CircleAlert : CircleHelp;
  return <div className="feedback-state" data-feedback={error ? 'error' : 'empty'} role={error ? 'alert' : 'status'}>
    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
    <span>{children}</span>
    {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RotateCw size={14} strokeWidth={1.75} aria-hidden="true" /> Thử lại</Button>}
  </div>;
}

/** Static geometry matching a page heading and its first data region. */
export function PageSkeleton({ label = 'Đang tải trang…' }: { label?: string }) {
  return <div className="page-skeleton" role="status" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div className="skeleton-line skeleton-title" /><div className="skeleton-line skeleton-subtitle" />
    <div className="skeleton-panel"><div className="skeleton-line skeleton-row" /><div className="skeleton-line skeleton-row" /><div className="skeleton-line skeleton-row" /></div>
  </div>;
}
