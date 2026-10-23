import { useEffect, useState } from 'react';
import { formatAbsolute, formatRelative } from '../i18n/vi';
import type { Concept } from './concept';

/** The business concept id (frame) under which the relative time label is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'frame';

/** A timestamp shown as "N minutes ago", refreshed every minute while the tab is visible, with the absolute time in its tooltip. */
export const TimeAgo = ({ at, className = '' }: Readonly<{ at: number | null | undefined; className?: string }>) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 60_000);
    return () => clearInterval(timer);
  }, []);
  const parsed = at == null ? null : new Date(at);
  const date = parsed !== null && Number.isFinite(parsed.getTime()) ? parsed : null;
  const validAt = date === null ? null : at;
  return <time className={className} dateTime={date === null ? undefined : date.toISOString()} title={`${formatAbsolute(validAt)} (UTC+7)`}>
    {formatRelative(validAt, now)}
  </time>;
};
