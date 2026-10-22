import type { Concept } from '../../concept';
/** Names the C8 evidence concept this module belongs to, for the unified-diff renderer. */
export const concept: Concept = 'C8';
import type { ReactNode } from 'react';
import { CopyButton, Frame, Toolbar } from './common';
import { cleanLines } from './text-view';
import { t } from '../../../i18n/t';

type Kind = 'file' | 'hunk' | 'add' | 'del' | 'ctx' | 'meta';
type Row = { id: number; kind: Kind; text: string; a: number | null; b: number | null };

const parseDiff = (lines: string[]): Row[] => {
  const rows: Row[] = [];
  const push = (row: Omit<Row, 'id'>) => rows.push({ id: rows.length, ...row });
  let a = 0; let b = 0; let inHunk = false;
  for (const l of lines) {
    if (l.startsWith('diff ')) { inHunk = false; push({ kind: 'file', text: l, a: null, b: null }); continue; }
    const hm = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l);
    if (hm) { a = Number(hm[1]); b = Number(hm[2]); inHunk = true; push({ kind: 'hunk', text: l, a: null, b: null }); continue; }
    if (!inHunk) { push({ kind: /^(---|\+\+\+) /.test(l) ? 'file' : 'meta', text: l, a: null, b: null }); continue; }
    if (l.startsWith('+')) push({ kind: 'add', text: l, a: null, b: b++ });
    else if (l.startsWith('-')) push({ kind: 'del', text: l, a: a++, b: null });
    else if (l.startsWith('\\')) push({ kind: 'meta', text: l, a: null, b: null });
    else push({ kind: 'ctx', text: l, a: a++, b: b++ });
  }
  return rows;
};

const style: Record<Kind, string> = {
  file: 'bg-default font-semibold text-foreground',
  meta: 'text-muted-foreground',
  hunk: 'bg-[var(--status-running-bg)] text-[var(--status-running)]',
  add: 'bg-[var(--status-success-bg)] text-[var(--status-success)]',
  del: 'bg-[var(--status-failed-bg)] text-[var(--status-failed)]',
  ctx: 'text-foreground',
};

type DiffTextViewProps = Readonly<{ text: string }>;

/** Unified diff: file headers, hunk headers, +/- colouring and old/new line numbers. */
export const DiffTextView = ({ text }: DiffTextViewProps) => {
  const rows = parseDiff(cleanLines(text));
  const adds = rows.filter(r => r.kind === 'add').length;
  const dels = rows.filter(r => r.kind === 'del').length;
  const num = (n: number | null): ReactNode => <span className="w-10 shrink-0 select-none pr-2 text-right tabular-nums text-muted-foreground/70">{n ?? ''}</span>;
  return (
    <Frame className="evidence-code-frame">
      <Toolbar right={<><span data-tone="success" className="text-[var(--tone)]">+{adds}</span><span data-tone="failed" className="text-[var(--tone)]">−{dels}</span></>}>
        <CopyButton value={text} label={t('Copy all')} />
      </Toolbar>
      <div className="max-h-[70vh] overflow-auto bg-background py-1">
        {rows.map(r => (
          <div key={r.id} className={`flex w-max min-w-full font-mono text-xs leading-5 ${style[r.kind]}`}>
            {num(r.a)}{num(r.b)}
            <span className="whitespace-pre pr-3">{r.text || ' '}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
};
