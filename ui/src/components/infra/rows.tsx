import type { Concept } from '../concept';
import type { Tone } from '../status';

export const concept: Concept = 'frame';

import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { t } from '../../i18n/t';

/** Compact number: 12 345 -> 12,3k. */
export const compactNumber = (value: number | null | undefined): string => {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
  return new Intl.NumberFormat('vi-VN').format(value);
};
export const usd = (value: number | null | undefined): string => (value == null ? '—' : `$${value.toFixed(value >= 100 ? 0 : 2)}`);

/** One label/value row; stacks label above value on narrow screens. */
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-1 border-b border-border py-2 text-[13px] last:border-b-0 sm:flex-row sm:items-start sm:gap-4">
    <dt className="shrink-0 text-muted-foreground sm:w-36">{label}</dt>
    <dd className="m-0 min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{children}</dd>
  </div>;
}

export function InfoChip({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <span data-tone={tone} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone ? 'border-[var(--tone-line)] bg-[var(--tone-bg)] text-[var(--tone)]' : 'border-border bg-muted text-muted-foreground'} ${tone === 'skipped' ? 'border-dashed' : ''}`}>{children}</span>;
}

/** Mono id with a copy button (copies `copy ?? value`). */
export function CopyId({ value, copy, title }: { value: string | null | undefined; copy?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-muted-foreground">—</span>;
  const full = copy ?? value;
  return <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
    <code className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs [overflow-wrap:anywhere]" title={title ?? full}>{value}</code>
    <button type="button" className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground" title={t('Copy the full value')}
      onClick={() => { void navigator.clipboard?.writeText(full).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }, () => undefined); }}>
      {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}{copied ? t('Copied') : t('Copy')}
    </button>
  </span>;
}

export const ShaId = ({ sha }: { sha: string | null | undefined }) => <CopyId value={sha ? sha.slice(0, 10) : null} copy={sha ?? undefined} title={sha ?? undefined} />;
