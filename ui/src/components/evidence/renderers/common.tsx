import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import { useState, type ReactNode } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import type { Tone } from '../../status';
import { t } from '../../../i18n/t';
import { Button } from '../../ui/button';
import { Card, Toolbar as HeroToolbar } from '@heroui/react';

export const toolbarBtn = 'text-xs';

export async function copyText(value: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(value); return true; } catch { /* clipboard blocked: fall through */ }
  try {
    const area = document.createElement('textarea');
    area.value = value; area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch { return false; }
}

export function CopyButton({ value, label = t('Copy text'), title, className = toolbarBtn, icon, labelClassName, disabled }: Readonly<{ value: string | (() => string); label?: string; title?: string; className?: string; icon?: ReactNode; labelClassName?: string; disabled?: boolean }>) {
  const [done, setDone] = useState(false);
  return (
    <Button type="button" variant="outline" size="xs" disabled={disabled} className={className} title={title ?? label} aria-label={title ?? label} onClick={async () => {
      if (await copyText(typeof value === 'function' ? value() : value)) { setDone(true); setTimeout(() => setDone(false), 1200); }
    }}>
      {done ? <CheckIcon className="size-3" /> : (icon ?? <CopyIcon className="size-3" />)}
      <span className={labelClassName}>{done ? t('Copied') : label}</span>
    </Button>
  );
}

const ESC = String.fromCodePoint(27);
const BEL = String.fromCodePoint(7);
const ANSI_RE = new RegExp(String.raw`${ESC}\[[0-9;?]*[ -/]*[@-~]|${ESC}\][^${BEL}]*(?:${BEL}|${ESC}\\)|${ESC}[()][A-Za-z0-9]`, 'g');
export function stripAnsi(text: string): string { return text.replace(ANSI_RE, ''); }

export function Toolbar({ children, right }: Readonly<{ children?: ReactNode; right?: ReactNode }>) {
  return (
    <HeroToolbar aria-label={t('Evidence')} className="flex w-full flex-wrap items-center gap-2 border-b bg-default/40 px-4 py-3">
      {children}
      {right ? <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">{right}</div> : null}
    </HeroToolbar>
  );
}

export function Frame({ children, className = '' }: Readonly<{ children: ReactNode; className?: string }>) {
  return <Card variant="transparent" className={`gap-0 overflow-hidden p-0 text-card-foreground ${className}`}>{children}</Card>;
}

/** One numbered line: gutter + content. */
export function Line({ n, children, tone, wrap = true }: Readonly<{ n: number | string; children: ReactNode; tone?: Tone; wrap?: boolean }>) {
  return (
    <div data-tone={tone} className={`flex min-w-full font-mono text-xs leading-5 ${tone ? 'bg-[var(--tone-bg)]' : ''} ${wrap ? '' : 'w-max'}`}>
      <span className="sticky left-0 w-12 shrink-0 select-none bg-inherit pr-3 text-right tabular-nums text-muted-foreground/70">{n}</span>
      <span className={`min-w-0 flex-1 pr-3 ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>{children}</span>
    </div>
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
