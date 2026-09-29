import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Concept } from '../concept';

export const concept: Concept = 'C17';

const isObject = (value: unknown): value is Record<string, unknown> | unknown[] => typeof value === 'object' && value !== null;

function Scalar({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === 'string') return <span className="break-words whitespace-pre-wrap text-foreground">"{value}"</span>;
  if (typeof value === 'number') return <span className="text-[color:var(--status-running)]">{value}</span>;
  return <span className="text-[color:var(--status-warning)]">{String(value)}</span>;
}

function Node({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const label = name != null ? <span className="text-muted-foreground">{name}: </span> : null;
  if (!isObject(value)) return <div className="py-px pl-4">{label}<Scalar value={value} /></div>;
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value);
  const brackets = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  if (!entries.length) return <div className="py-px pl-4">{label}<span className="text-muted-foreground">{brackets[0]}{brackets[1]}</span></div>;
  return <div className="py-px">
    <button type="button" className="flex items-start gap-1 text-left hover:text-primary" aria-expanded={open} onClick={() => setOpen(!open)}>
      <ChevronRight className={`mt-0.5 size-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
      <span>{label}<span className="text-muted-foreground">{brackets[0]}{open ? '' : ` ${entries.length} mục ${brackets[1]}`}</span></span>
    </button>
    {open && <div className="ml-1.5 border-l border-border/60 pl-2.5">{entries.map(([key, item]) => <Node key={key} name={key} value={item} depth={depth + 1} />)}<div className="pl-4 text-muted-foreground">{brackets[1]}</div></div>}
  </div>;
}

/** Collapsible JSON tree (no HTML injection: every leaf is rendered as text). */
export function JsonTree({ value }: { value: unknown }) {
  return <div className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[11.5px] leading-5" aria-label="Dữ liệu JSON"><Node value={value} depth={0} /></div>;
}
