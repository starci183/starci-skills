import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import { useState, type ReactNode } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import type { Tone } from '../../status';

export const toolbarBtn = 'inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40';

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

export function CopyButton({ value, label = 'Sao chép', title, className = toolbarBtn }: { value: string | (() => string); label?: string; title?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={className} title={title ?? label} onClick={async () => {
      if (await copyText(typeof value === 'function' ? value() : value)) { setDone(true); setTimeout(() => setDone(false), 1200); }
    }}>
      {done ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
      <span>{done ? 'Đã chép' : label}</span>
    </button>
  );
}

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]|${ESC}\\][^${BEL}]*(?:${BEL}|${ESC}\\\\)|${ESC}[()][A-Za-z0-9]`, 'g');
export function stripAnsi(text: string): string { return text.replace(ANSI_RE, ''); }

/** Outcome-like words get a status tone wherever they appear as a value. */
export function wordTone(word: string): Tone | null {
  switch (word.toLowerCase()) {
    case 'pass': case 'passed': case 'done': case 'success': case 'succeeded': case 'ok': return 'success';
    case 'fail': case 'failed': case 'blocked': case 'error': return 'failed';
    case 'partial': case 'retry': case 'warn': case 'warning': return 'warning';
    case 'deferred': case 'skipped': case 'dropped': return 'skipped';
    default: return null;
  }
}

export function Toolbar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-2 py-1.5">
      {children}
      {right ? <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">{right}</div> : null}
    </div>
  );
}

export function Frame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-lg border bg-card text-card-foreground ${className}`}>{children}</div>;
}

/** One numbered line: gutter + content. */
export function Line({ n, children, tone, wrap = true }: { n: number | string; children: ReactNode; tone?: Tone; wrap?: boolean }) {
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
