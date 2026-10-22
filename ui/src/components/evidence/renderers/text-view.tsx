import type { Concept } from '../../concept';
/** Names the C8 evidence concept this module belongs to, for the line-numbered text renderer. */
export const concept: Concept = 'C8';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, WrapTextIcon } from 'lucide-react';
import type { Tone } from '../../status';
import { CopyButton, Frame, Line, stripAnsi, Toolbar, toolbarBtn } from './common';
import { t } from '../../../i18n/t';
import { Button } from '../../ui/button';
import { InputGroup } from '@heroui/react';

const ERROR_RE = /error|fail|✗|SCHEMA_VIOLATION|exception|fatal|panic/i;
const WARN_RE = /warn|⚠|deprecated/i;
const ROW = 20;
const WINDOW_AT = 5000;
const HEIGHT = 560;

/** Splits raw output into display lines: ANSI stripped and carriage-return overwrites resolved to the last write. */
export const cleanLines = (text: string): string[] => {
  return stripAnsi(text).split('\n').map(l => {
    const line = l.endsWith('\r') ? l.slice(0, -1) : l;
    const i = line.lastIndexOf('\r');
    return i >= 0 ? line.slice(i + 1) : line;
  });
};

type Hit = { line: number; start: number; end: number };
type Entry = { hit: Hit; idx: number };

const lineTone = (line: string): Tone | undefined => {
  if (ERROR_RE.test(line)) return 'failed';
  if (WARN_RE.test(line)) return 'warning';
  return undefined;
};

const renderLine = (line: string, hits: Entry[] | undefined, current: number): ReactNode[] => {
  if (!hits?.length) return [line || ' '];
  const out: ReactNode[] = [];
  let at = 0;
  for (const { hit, idx } of hits) {
    if (hit.start > at) out.push(line.slice(at, hit.start));
    out.push(<mark key={idx} data-hit={idx === current ? 'current' : 'other'} className={`rounded-sm px-0.5 text-foreground ${idx === current ? 'bg-primary/40 outline outline-1 outline-primary' : 'bg-primary/20'}`}>{line.slice(hit.start, hit.end)}</mark>);
    at = hit.end;
  }
  if (at < line.length) out.push(line.slice(at));
  return out;
};

const HIT_CAP = 10000;
type HitIndex = { hits: Hit[]; byLine: Map<number, Entry[]>; capped: boolean };

/** Every case-insensitive occurrence of the needle, capped at 10 000 hits. */
const findHits = (lines: readonly string[], q: string): HitIndex => {
  const hits: Hit[] = [];
  const byLine = new Map<number, Entry[]>();
  const needle = q.toLowerCase();
  if (!needle) return { hits, byLine, capped: false };
  for (const [i, line] of lines.entries()) {
    const hay = line.toLowerCase();
    let from = hay.indexOf(needle);
    while (from >= 0) {
      if (hits.length >= HIT_CAP) return { hits, byLine, capped: true };
      const hit = { line: i, start: from, end: from + needle.length };
      const entry = { hit, idx: hits.length };
      hits.push(hit);
      const arr = byLine.get(i);
      if (arr) arr.push(entry); else byLine.set(i, [entry]);
      from = hay.indexOf(needle, from + needle.length);
    }
  }
  return { hits, byLine, capped: false };
};

/** Keeps the current hit in view, by row arithmetic when windowed and by measuring the mark otherwise. */
const useScrollToHit = (hit: Hit | undefined, current: number, windowed: boolean): RefObject<HTMLDivElement | null> => {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !hit) return;
    if (windowed) { el.scrollTop = Math.max(0, hit.line * ROW - HEIGHT / 2); return; }
    const mark = el.querySelector<HTMLElement>('[data-hit=current]');
    if (mark) {
      const top = mark.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      el.scrollTop = Math.max(0, top - el.clientHeight / 2);
    }
  }, [box, hit, current, windowed]);
  return box;
};

const WindowedBody = ({ lines, byLine, current, scrollTop }: Readonly<{ lines: readonly string[]; byLine: Map<number, Entry[]>; current: number; scrollTop: number }>) => {
  const first = Math.max(0, Math.floor(scrollTop / ROW) - 30);
  const last = Math.min(lines.length, Math.ceil((scrollTop + HEIGHT) / ROW) + 30);
  const rows = lines.slice(first, last).map((line, offset) => {
    const i = first + offset;
    return <Line key={i} n={i + 1} tone={lineTone(line)} wrap={false}>{renderLine(line, byLine.get(i), current)}</Line>;
  });
  return <div style={{ height: lines.length * ROW, position: 'relative' }}><div style={{ position: 'absolute', top: first * ROW, left: 0, right: 0 }}>{rows}</div></div>;
};

type NumberedLine = { n: number; text: string };

const FlatBody = ({ lines, byLine, current, wrap }: Readonly<{ lines: readonly string[]; byLine: Map<number, Entry[]>; current: number; wrap: boolean }>) => {
  const numbered = lines.map((text, at): NumberedLine => ({ n: at + 1, text }));
  return <>{numbered.map(row => <Line key={row.n} n={row.n} tone={lineTone(row.text)} wrap={wrap}>{renderLine(row.text, byLine.get(row.n - 1), current)}</Line>)}</>;
};

const hitCounter = (current: number, hits: readonly Hit[], capped: boolean): string => {
  return hits.length ? `${current + 1}/${hits.length}${capped ? '+' : ''}` : t('None');
};

/** Plain text / log / stdout. ANSI stripped, searchable, windowed above 5 000 lines. */
export const TextView = ({ text, query, className = '' }: Readonly<{ text: string; query: string; className?: string }>) => {
  const lines = useMemo(() => cleanLines(text), [text]);
  const windowed = lines.length > WINDOW_AT;
  const [wrap, setWrap] = useState(true);
  const [q, setQ] = useState(query ?? '');
  const [seenQuery, setSeenQuery] = useState(query);
  const [curState, setCurState] = useState({ q, cur: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  // An incoming query replaces the local search box.
  if (seenQuery !== query) { setSeenQuery(query); setQ(query ?? ''); }
  const effectiveWrap = wrap && !windowed;

  const { hits, byLine, capped } = useMemo(() => findHits(lines, q), [lines, q]);

  // The selected hit belongs to one search string and restarts at the first hit when it changes.
  const cur = curState.q === q ? curState.cur : 0;
  const current = hits.length ? Math.min(cur, hits.length - 1) : 0;
  const box = useScrollToHit(hits[current], current, windowed);

  const step = (d: number) => { if (hits.length) setCurState({ q, cur: (current + d + hits.length) % hits.length }); };

  return (
    <Frame className={`evidence-code-frame ${className}`}>
      <Toolbar right={<><span>{t('{n} lines', { n: lines.length.toLocaleString('vi-VN') })}</span>{windowed ? <span>{t('(windowed, no wrapping)')}</span> : null}</>}>
        <InputGroup className="w-40 min-w-0 sm:w-52">
          <InputGroup.Prefix><SearchIcon className="size-4 text-muted-foreground" /></InputGroup.Prefix>
          <InputGroup.Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search in file')} aria-label={t('Search in file')}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } }}
            className="min-w-0 text-sm" />
        </InputGroup>
        {q ? <span className="text-[11px] tabular-nums text-muted-foreground" aria-live="polite">{hitCounter(current, hits, capped)}</span> : null}
        <Button variant="outline" size="xs" type="button" className={toolbarBtn} onClick={() => step(-1)} disabled={!hits.length} aria-label={t('Previous result')} title={t('Previous result (Shift+Enter)')}><ChevronUpIcon className="size-3" /></Button>
        <Button variant="outline" size="xs" type="button" className={toolbarBtn} onClick={() => step(1)} disabled={!hits.length} aria-label={t('Next result')} title={t('Next result (Enter)')}><ChevronDownIcon className="size-3" /></Button>
        <Button variant="outline" size="xs" type="button" className={toolbarBtn} onClick={() => setWrap(w => !w)} aria-pressed={effectiveWrap} disabled={windowed}><WrapTextIcon className="size-3" />{effectiveWrap ? t('Wrap') : t('One line')}</Button>
        <CopyButton value={() => lines.join('\n')} label={t('Copy all')} />
      </Toolbar>
      <div ref={box} onScroll={windowed ? e => setScrollTop(e.currentTarget.scrollTop) : undefined}
        className="relative overflow-auto bg-background py-1" style={windowed ? { height: HEIGHT } : { maxHeight: '70vh' }}>
        {windowed ? <WindowedBody lines={lines} byLine={byLine} current={current} scrollTop={scrollTop} /> : <FlatBody lines={lines} byLine={byLine} current={current} wrap={effectiveWrap} />}
      </div>
    </Frame>
  );
};
