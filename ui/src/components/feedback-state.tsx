import { CircleAlert, CircleHelp, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './ui/button';
import { Alert, Card, Description, EmptyState } from '@heroui/react';
import { Skeleton } from './ui/skeleton';
import type { Concept } from './concept';
import { t } from '../i18n/t';

export const concept: Concept = 'frame';

/** A failed or partial source read stays separate from the recorded product outcome. */
export function SourceWarning({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <Alert status="warning" className={className} role="status">
    <Alert.Indicator><CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" /></Alert.Indicator>
    <Alert.Content><Alert.Description className="min-w-0 break-words">{children}</Alert.Description></Alert.Content>
  </Alert>;
}

/** One quiet pattern for a missing result or a failed read. */
export function FeedbackState({ children, error = false, onRetry }: Readonly<{ children: ReactNode; error?: boolean; onRetry?: () => void }>) {
  const retry = onRetry ? <Button variant="outline" size="sm" onClick={onRetry}><RotateCw size={14} strokeWidth={1.75} aria-hidden="true" /> {t('Retry')}</Button> : null;
  if (error) return <Alert status="danger" className="min-w-0" data-feedback="error" role="alert">
    <Alert.Indicator><CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" /></Alert.Indicator>
    <Alert.Content><Alert.Description className="break-words">{children}</Alert.Description>{retry}</Alert.Content>
  </Alert>;
  return <EmptyState className="min-w-0 gap-3 py-6" data-feedback="empty" role="status">
    <CircleHelp size={20} strokeWidth={1.75} aria-hidden="true" />
    <Description className="break-words text-center">{children}</Description>{retry}
  </EmptyState>;
}

/** Static geometry matching a page heading and its first data region. */
export function PageSkeleton({ label = t('Loading page…') }: Readonly<{ label?: string }>) {
  return <output className="page-skeleton" aria-label={label}>
    <span className="sr-only">{label}</span>
    <Skeleton className="skeleton-title block" /><Skeleton className="skeleton-subtitle block" />
    <Card className="skeleton-panel"><Card.Content className="grid gap-4"><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" /></Card.Content></Card>
  </output>;
}
