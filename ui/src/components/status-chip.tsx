import type { ReactNode } from 'react';
import { liveStatuses, statusLabels, statusTone, type Status } from './status';
import type { Concept } from './concept';
import { t } from '../i18n/t';
import { Badge } from './ui/badge';

/** The business concept id (frame) under which the status chips is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'frame';

type StatusChipProps = { readonly status: Status; readonly label?: ReactNode; readonly suffix?: ReactNode; readonly className?: string };

/** Semantic status chip: colour from the status tone, localized label, optional suffix. */
export const StatusChip = ({ status, label, suffix, className = '' }: StatusChipProps) => {
  return <Badge variant="outline" className={`status-chip ${className}`} data-tone={statusTone[status]} data-live={liveStatuses.has(status)} data-status={status}>
    <span className="status-dot" aria-hidden="true" />
    <span>{label ?? statusLabels[status]}{suffix != null ? <> · {suffix}</> : null}</span>
  </Badge>;
};

type StatusDotProps = { readonly status: Status; readonly title?: string };

/** A bare coloured dot for a status, for places too tight for a chip, labelled for assistive technology. */
export const StatusDot = ({ status, title }: StatusDotProps) => {
  return <span className="status-dot" data-tone={statusTone[status]} title={title ?? statusLabels[status]} aria-label={title ?? statusLabels[status]} role="img" />;
};

const kindLabels: Record<string, string> = { json: 'JSON', yaml: 'YAML', markdown: 'MD', text: 'LOG', diff: 'DIFF', image: t('IMG'), video: 'VIDEO', audio: 'AUDIO', pdf: 'PDF', binary: 'BIN' };

type FileTypeBadgeProps = { readonly kind: string };

/** Neutral file-type chip for evidence rows; its label comes from the recorded kind. */
export const FileTypeBadge = ({ kind }: FileTypeBadgeProps) => {
  return <Badge variant="outline" data-kind={kind} className="file-badge">{kindLabels[kind] ?? kind.toUpperCase()}</Badge>;
};
