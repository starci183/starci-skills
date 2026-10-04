import type { ReactNode } from 'react';
import { liveStatuses, statusLabels, statusTone, type Status } from './status';
import type { Concept } from './concept';
import { t } from '../i18n/t';
import { Badge } from './ui/badge';

export const concept: Concept = 'frame';

/** Semantic status chip: colour from the status tone, localized label, optional suffix. */
export function StatusChip({ status, label, suffix, className = '' }: { status: Status; label?: ReactNode; suffix?: ReactNode; className?: string }) {
  return <Badge variant="outline" className={`status-chip ${className}`} data-tone={statusTone[status]} data-live={liveStatuses.has(status)} data-status={status}>
    <span className="status-dot" aria-hidden="true" />
    <span>{label ?? statusLabels[status]}{suffix != null ? <> · {suffix}</> : null}</span>
  </Badge>;
}

export function StatusDot({ status, title }: { status: Status; title?: string }) {
  return <span className="status-dot" data-tone={statusTone[status]} title={title ?? statusLabels[status]} aria-label={title ?? statusLabels[status]} role="img" />;
}

const kindLabels: Record<string, string> = { json: 'JSON', yaml: 'YAML', markdown: 'MD', text: 'LOG', diff: 'DIFF', image: t('IMG'), video: 'VIDEO', audio: 'AUDIO', pdf: 'PDF', binary: 'BIN' };

/** File-type badge for evidence rows (tint per kind in style.css). */
export function FileTypeBadge({ kind }: { kind: string }) {
  return <span data-kind={kind} className="file-badge">{kindLabels[kind] ?? kind.toUpperCase()}</span>;
}
