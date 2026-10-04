import { useEffect, useState } from 'react';
import { formatAbsolute, formatRelative } from '../i18n/vi';
import type { Concept } from './concept';

export const concept: Concept = 'frame';

export function TimeAgo({ at, className = '' }: { at: number | null | undefined; className?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 60_000);
    return () => clearInterval(timer);
  }, []);
  const date = at == null ? null : new Date(at);
  const validAt = date && Number.isFinite(date.getTime()) ? at : null;
  return <time className={className} dateTime={validAt == null ? undefined : date!.toISOString()} title={`${formatAbsolute(validAt)} (UTC+7)`}>
    {formatRelative(validAt, now)}
  </time>;
}
