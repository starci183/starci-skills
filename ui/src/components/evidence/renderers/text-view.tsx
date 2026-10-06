import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, WrapTextIcon } from 'lucide-react';
import type { Tone } from '../../status';
import { CopyButton, Frame, Line, stripAnsi, Toolbar, toolbarBtn } from './common';
import { t } from '../../../i18n/t';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';

const ERROR_RE = /error|fail|✗|SCHEMA_VIOLATION|exception|fatal|panic/i;
const WARN_RE = /warn|⚠|deprecated/i;
const ROW = 20;
const WINDOW_AT = 5000;
const HEIGHT = 560;

export function cleanLines(text: string): string[] {
  return stripAnsi(text).split('\n').map(l => {
    const line = l.endsWith('\r') ? l.slice(0, -1) : l;
    const i = line.lastIndexOf('\r');
    return i >= 0 ? line.slice(i + 1) : line;
  });
}

type Hit = { line: number; start: number; end: number };
type Entry = { hit: Hit; idx: number };

function lineTone(line: string): Tone | undefined {
  if (ERROR_RE.test(line)) return 'failed';
  if (WARN_RE.test(line)) return 'warning';
  return undefined;
}

function renderLine(line: string, hits: Entry[] | undefined, current: number): ReactNode {
  if (!hits?.length) return line || ' ';
  const out: ReactNode[] = [];
  let at = 0;
  for (const { hit, idx } of hits) {
    if (hit.start > at) out.push(line.slice(at, hit.start));
    out.push(<mark key={idx} data-hit={idx === current ? 'current' : 'other'} className={`rounded-sm px-0.5 text-foreground ${idx === current ? 'bg-primary/40 outline outline-1 outline-primary' : 'bg-primary/20'}`}>{line.slice(hit.start, hit.end)}</mark>);
    at = hit.end;
  }
  if (at < line.length) out.push(line.slice(at));
  return out;
}

/** Plain text / log / stdout. ANSI stripped, searchable, windowed above 5 000 lines. */
export function TextView({ text, query, className = '' }: Readonly<{ text: string; query: string; className?: string }>) {
  const lines = useMemo(() => cleanLines(text), [text]);
  const windowed = lines.length > WINDOW_AT;
  const [wrap, setWrap] = useState(true);
  const [q, setQ] = useState(query ?? '');
  const [cur, setCur] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setQ(query ?? ''); }, [query]);
  const effectiveWrap = wrap && !windowed;

  const { hits, byLine, capped } = useMemo(() => {
    const list: Hit[] = [];
    const map = new Map<number, Entry[]>();
    const needle = q.toLowerCase();
    let cap = false;
    if (needle) {
      outer: for (let i = 0; i < lines.length; i++) {
        const hay = lines[i].toLowerCase();
        let from = 0;
        for (;;) {
          const at = hay.indexOf(needle, from);
          if (at < 0) break;
          if (list.length >= 10000) { cap = true; break outer; }
          const hit = { line: i, start: at, end: at + needle.length };
          const entry = { hit, idx: list.length };
          list.push(hit);
          const arr = map.get(i); if (arr) arr.push(entry); else map.set(i, [entry]);
          from = at + needle.length;
        }
      }
    }
    return { hits: list, byLine: map, capped: cap };
  }, [lines, q]);

  const current = hits.length ? Math.min(cur, hits.length - 1) : 0;
  useEffect(() => { setCur(0); }, [q]);
  useEffect(() => {
    const el = box.current; const hit = hits[current];
    if (!el || !hit) return;
    if (windowed) { el.scrollTop = Math.max(0, hit.line * ROW - HEIGHT / 2); return; }
    const mark = el.querySelector<HTMLElement>('[data-hit=current]');
    if (mark) {
      const top = mark.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      el.scrollTop = Math.max(0, top - el.clientHeight / 2);
    }
  }, [current, hits, windowed]);

  const step = (d: number) => { if (hits.length) setCur((current + d + hits.length) % hits.length); };

  let body: ReactNode;
  if (windowed) {
    const first = Math.max(0, Math.floor(scrollTop / ROW) - 30);
    const last = Math.min(lines.length, Math.ceil((scrollTop + HEIGHT) / ROW) + 30);
    const rows: ReactNode[] = [];
    for (let i = first; i < last; i++) rows.push(<Line key={i} n={i + 1} tone={lineTone(lines[i])} wrap={false}>{renderLine(lines[i], byLine.get(i), current)}</Line>);
    body = <div style={{ height: lines.length * ROW, position: 'relative' }}><div style={{ position: 'absolute', top: first * ROW, left: 0, right: 0 }}>{rows}</div></div>;
  } else {
    const nodes: ReactNode[] = [];
    for (let i = 0; i < lines.length; i++) nodes.push(<Line key={i} n={i + 1} tone={lineTone(lines[i])} wrap={effectiveWrap}>{renderLine(lines[i], byLine.get(i), current)}</Line>);
    body = nodes;
  }

  return (
    <Frame className={`evidence-code-frame ${className}`}>
      <Toolbar right={<><span>{t('{n} lines', { n: lines.length.toLocaleString('vi-VN') })}</span>{windowed ? <span>{t('(windowed, no wrapping)')}</span> : null}</>}>
        <label className="flex min-w-0 items-center gap-1 rounded-md border bg-background px-2 py-0.5 focus-within:outline-2 focus-within:outline-ring">
          <SearchIcon className="size-3 shrink-0 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search in file')} aria-label={t('Search in file')}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } }}
            className="w-32 min-w-0 bg-transparent text-xs outline-none sm:w-44" />
        </label>
        {q ? <span className="text-[11px] tabular-nums text-muted-foreground" aria-live="polite">{hits.length ? `${current + 1}/${hits.length}${capped ? '+' : ''}` : t('None')}</span> : null}
        <Button variant="outline" size="xs" type="button" className={toolbarBtn} onClick={() => step(-1)} disabled={!hits.length} aria-label={t('Previous result')} title={t('Previous result (Shift+Enter)')}><ChevronUpIcon className="size-3" /></Button>
        <Button variant="outline" size="xs" type="button" className={toolbarBtn} onClick={() => step(1)} disabled={!hits.length} aria-label={t('Next result')} title={t('Next result (Enter)')}><ChevronDownIcon className="size-3" /></Button>
        <Button variant="outline" size="xs" type="button" className={toolbarBtn} onClick={() => setWrap(w => !w)} aria-pressed={effectiveWrap} disabled={windowed}><WrapTextIcon className="size-3" />{effectiveWrap ? t('Wrap') : t('One line')}</Button>
        <CopyButton value={() => lines.join('\n')} label={t('Copy all')} />
      </Toolbar>
      <div ref={box} onScroll={windowed ? e => setScrollTop(e.currentTarget.scrollTop) : undefined}
        className="relative overflow-auto bg-background py-1" style={windowed ? { height: HEIGHT } : { maxHeight: '70vh' }}>
        {body}
      </div>
    </Frame>
  );
}
