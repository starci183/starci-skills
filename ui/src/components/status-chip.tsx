import type { ReactNode } from 'react';
import { liveStatuses, statusLabels, statusTone, type Status } from './status';
import type { Concept } from './concept';

export const concept: Concept = 'frame';

/** Semantic status chip: colour from the status tone, label in Vietnamese, optional suffix. */
export function StatusChip({ status, label, suffix, className = '' }: { status: Status; label?: ReactNode; suffix?: ReactNode; className?: string }) {
  return <span className={`status-chip ${className}`} data-tone={statusTone[status]} data-live={liveStatuses.has(status)} data-status={status}>
    <span className="status-dot" aria-hidden="true" />
    <span>{label ?? statusLabels[status]}{suffix != null ? <> · {suffix}</> : null}</span>
  </span>;
}

export function StatusDot({ status, title }: { status: Status; title?: string }) {
  return <span className="status-dot" data-tone={statusTone[status]} title={title ?? statusLabels[status]} aria-label={title ?? statusLabels[status]} role="img" />;
}

const kindLabels: Record<string, string> = { json: 'JSON', yaml: 'YAML', markdown: 'MD', text: 'LOG', diff: 'DIFF', image: 'ẢNH', video: 'VIDEO', audio: 'AUDIO', pdf: 'PDF', binary: 'BIN' };

/** File-type badge for evidence rows (S01 refines the per-kind tint). */
export function FileTypeBadge({ kind }: { kind: string }) {
  return <span data-kind={kind} className="inline-flex min-w-11 justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10.5px] font-semibold tracking-wide text-muted-foreground">{kindLabels[kind] ?? kind.toUpperCase()}</span>;
}
