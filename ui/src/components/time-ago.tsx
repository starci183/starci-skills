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
  return <time className={className} dateTime={at == null ? undefined : new Date(at).toISOString()} title={`${formatAbsolute(at)} (UTC+7)`}>
    {formatRelative(at, now)}
  </time>;
}
