import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, LinkIcon } from 'lucide-react';
import type { Tone } from '../../status';
import { CopyButton, Frame, Toolbar, toolbarBtn, wordTone } from './common';
import { TextView } from './text-view';
import { t } from '../../../i18n/t';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Parsed = { ok: true; docs: Json[]; jsonl: boolean } | { ok: false; error: string };
type Mode = { m: 'default' | 'all' | 'none'; n: number };

const PAGE = 200;
const LONG = 300;

function parseJson(text: string): Parsed {
  const src = text.replace(/^﻿/, '').trim();
  if (!src) return { ok: false, error: t('Empty file.') };
  let first = '';
  try { return { ok: true, docs: [JSON.parse(src) as Json], jsonl: false }; } catch (e) { first = e instanceof Error ? e.message : String(e); }
  const lines = src.split(/\r?\n/).filter(l => l.trim());
  if (lines.length > 1) {
    try { return { ok: true, docs: lines.map(l => JSON.parse(l) as Json), jsonl: true }; } catch { /* not JSONL either */ }
  }
  return { ok: false, error: first };
}

const isContainer = (v: Json): v is Json[] | { [k: string]: Json } => v !== null && typeof v === 'object';
const keyPath = (base: string, k: string | number) => typeof k === 'number' ? `${base}[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `${base}.${k}` : `${base}[${JSON.stringify(k)}]`;

function leafTone(v: Json): Tone | null {
  if (v === true) return 'success';
  if (v === false) return 'failed';
  if (typeof v === 'string') return wordTone(v);
  return null;
}

function Leaf({ v }: Readonly<{ v: Json }>) {
  const [more, setMore] = useState(false);
  if (v === null) return <span className="italic text-muted-foreground">null</span>;
  const tone = leafTone(v);
  if (typeof v === 'string') {
    const long = v.length > LONG && !more;
    return (
      <span data-tone={tone ?? undefined} className={`whitespace-pre-wrap break-words ${tone ? 'font-medium text-[var(--tone)]' : 'text-foreground'}`}>
        &quot;{long ? v.slice(0, LONG) : v}&quot;
        {v.length > LONG ? <button type="button" className="ml-1 text-[11px] text-primary underline" onClick={() => setMore(m => !m)}>{more ? t('collapse') : t('… {n} more characters', { n: v.length - LONG })}</button> : null}
      </span>
    );
  }
  if (typeof v === 'boolean') return <span data-tone={tone ?? undefined} className="font-medium text-[var(--tone)]">{String(v)}</span>;
  return <span data-tone="running" className="text-[var(--tone)]">{JSON.stringify(v)}</span>;
}

/** Hover-revealed on a mouse; on touch (coarse pointer) an always-visible icon pair at the end of the row, in flow so it never covers text. */
const touchBtn = `${toolbarBtn} pointer-coarse:size-7 pointer-coarse:justify-center pointer-coarse:px-0`;
function Actions({ value, path }: Readonly<{ value: Json; path: string }>) {
  return (
    <span className="absolute right-1 top-0 flex shrink-0 gap-1 rounded-md bg-card opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 pointer-coarse:static pointer-coarse:ml-auto pointer-coarse:bg-transparent pointer-coarse:opacity-100">
      <CopyButton className={touchBtn} labelClassName="pointer-coarse:sr-only" value={() => typeof value === 'string' ? value : JSON.stringify(value, null, 2)} label={t('Value')} title={t('Copy the value')} />
      <CopyButton className={touchBtn} labelClassName="pointer-coarse:sr-only" icon={<LinkIcon className="size-3" />} value={path} label={t('Path')} title={t('Copy path {path}', { path })} />
    </span>
  );
}

function Node({ k, v, path, depth, mode }: Readonly<{ k: string | number | null; v: Json; path: string; depth: number; mode: Mode }>) {
  const container = isContainer(v);
  const [open, setOpen] = useState(() => mode.m === 'all' || (mode.m === 'default' && depth < 2));
  const [limit, setLimit] = useState(PAGE);
  const label = k === null ? null : (
    <span className={typeof k === 'number' ? 'text-muted-foreground' : 'font-medium text-foreground/80'}>{typeof k === 'number' ? k : `"${k}"`}<span className="text-muted-foreground">: </span></span>
  );
  if (!container) {
    return (
      <div className="group/row relative flex items-start gap-1 py-px pl-4">
        <span className="min-w-0 flex-1 break-words">{label}<Leaf v={v} /></span>
        <Actions value={v} path={path} />
      </div>
    );
  }
  const isArr = Array.isArray(v);
  const entries: [string | number, Json][] = isArr ? v.map((x, i) => [i, x]) : Object.entries(v);
  const shown = entries.slice(0, limit);
  return (
    <div>
      <div className="group/row relative flex items-start gap-1 py-px">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex min-w-0 items-start gap-0.5 rounded text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
          {open ? <ChevronDownIcon className="mt-0.5 size-3.5 shrink-0" /> : <ChevronRightIcon className="mt-0.5 size-3.5 shrink-0" />}
          <span>{label}<span className="text-muted-foreground">{isArr ? '[' : '{'}{open ? '' : ` ${entries.length} ${isArr ? t('items') : t('keys')} ${isArr ? ']' : '}'}`}</span></span>
        </button>
        <Actions value={v} path={path} />
      </div>
      {open ? (
        <div className="ml-[7px] border-l pl-3">
          {entries.length === 0 ? <div className="py-px pl-4 text-muted-foreground">{isArr ? t('empty array') : t('empty object')}</div> : null}
          {shown.map(([ck, cv]) => <Node key={ck} k={ck} v={cv} path={keyPath(path, ck)} depth={depth + 1} mode={mode} />)}
          {entries.length > limit ? (
            <button type="button" className={`${toolbarBtn} my-1 ml-4`} onClick={() => setLimit(l => l + PAGE)}>{t('more {n} ({remaining} left)', { n: Math.min(PAGE, entries.length - limit), remaining: entries.length - limit })}</button>
          ) : null}
          <div className="py-px pl-4 text-muted-foreground">{isArr ? ']' : '}'}</div>
        </div>
      ) : null}
    </div>
  );
}

/** JSON / JSONL as a collapsible coloured tree. Invalid JSON falls back to text with a warning. */
export function JsonView({ text }: Readonly<{ text: string }>) {
  const [mode, setMode] = useState<Mode>({ m: 'default', n: 0 });
  const [raw, setRaw] = useState(false);
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return (
      <div className="space-y-2">
        <div data-tone="warning" className="rounded-lg border border-[var(--tone-line)] bg-[var(--tone-bg)] px-3 py-2 text-xs text-[var(--tone)]">{t('Not valid JSON ({error}). Shown as text.', { error: parsed.error })}</div>
        <TextView text={text} query="" />
      </div>
    );
  }
  const single = !parsed.jsonl;
  return (
    <Frame className="evidence-code-frame">
      <Toolbar right={<span>{parsed.jsonl ? t('JSONL · {n} lines', { n: parsed.docs.length }) : 'JSON'}</span>}>
        {!raw ? <>
          <button type="button" className={toolbarBtn} onClick={() => setMode(s => ({ m: 'all', n: s.n + 1 }))}>{t('Expand all')}</button>
          <button type="button" className={toolbarBtn} onClick={() => setMode(s => ({ m: 'none', n: s.n + 1 }))}>{t('Collapse all')}</button>
        </> : null}
        <button type="button" className={toolbarBtn} aria-pressed={raw} onClick={() => setRaw(r => !r)}>{raw ? t('View tree') : t('View raw')}</button>
        <CopyButton value={text} label={t('Copy all')} />
      </Toolbar>
      {raw ? <TextView text={text} query="" className="rounded-none border-0" /> : (
        <div key={mode.n} className="max-h-[70vh] overflow-auto bg-background p-3 font-mono text-xs leading-5">
          {single
            ? <Node k={null} v={parsed.docs[0]} path="$" depth={0} mode={mode} />
            : parsed.docs.map((d, i) => <Node key={`${i}-${typeof d}`} k={t('line {n}', { n: i + 1 })} v={d} path={`$[${i}]`} depth={0} mode={mode} />)}
        </div>
      )}
    </Frame>
  );
}
