import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import type { ReactNode } from 'react';
import { CopyButton, Frame, Toolbar } from './common';
import { cleanLines } from './text-view';
import { t } from '../../../i18n/t';

type Kind = 'file' | 'hunk' | 'add' | 'del' | 'ctx' | 'meta';
type Row = { kind: Kind; text: string; a: number | null; b: number | null };

function parseDiff(lines: string[]): Row[] {
  const rows: Row[] = [];
  let a = 0; let b = 0; let inHunk = false;
  for (const l of lines) {
    if (l.startsWith('diff ')) { inHunk = false; rows.push({ kind: 'file', text: l, a: null, b: null }); continue; }
    const hm = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l);
    if (hm) { a = Number(hm[1]); b = Number(hm[2]); inHunk = true; rows.push({ kind: 'hunk', text: l, a: null, b: null }); continue; }
    if (!inHunk) { rows.push({ kind: /^(---|\+\+\+) /.test(l) ? 'file' : 'meta', text: l, a: null, b: null }); continue; }
    if (l.startsWith('+')) rows.push({ kind: 'add', text: l, a: null, b: b++ });
    else if (l.startsWith('-')) rows.push({ kind: 'del', text: l, a: a++, b: null });
    else if (l.startsWith('\\')) rows.push({ kind: 'meta', text: l, a: null, b: null });
    else rows.push({ kind: 'ctx', text: l, a: a++, b: b++ });
  }
  return rows;
}

const style: Record<Kind, string> = {
  file: 'bg-muted font-semibold text-foreground',
  meta: 'text-muted-foreground',
  hunk: 'bg-[var(--status-running-bg)] text-[var(--status-running)]',
  add: 'bg-[var(--status-success-bg)] text-[var(--status-success)]',
  del: 'bg-[var(--status-failed-bg)] text-[var(--status-failed)]',
  ctx: 'text-foreground',
};

/** Unified diff: file headers, hunk headers, +/- colouring and old/new line numbers. */
export function DiffTextView({ text }: { text: string }) {
  const rows = parseDiff(cleanLines(text));
  const adds = rows.filter(r => r.kind === 'add').length;
  const dels = rows.filter(r => r.kind === 'del').length;
  const num = (n: number | null): ReactNode => <span className="w-10 shrink-0 select-none pr-2 text-right tabular-nums text-muted-foreground/70">{n ?? ''}</span>;
  return (
    <Frame>
      <Toolbar right={<><span data-tone="success" className="text-[var(--tone)]">+{adds}</span><span data-tone="failed" className="text-[var(--tone)]">−{dels}</span></>}>
        <CopyButton value={text} label={t('Copy all')} />
      </Toolbar>
      <div className="max-h-[70vh] overflow-auto bg-background py-1">
        {rows.map((r, i) => (
          <div key={i} className={`flex w-max min-w-full font-mono text-xs leading-5 ${style[r.kind]}`}>
            {num(r.a)}{num(r.b)}
            <span className="whitespace-pre pr-3">{r.text || ' '}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
