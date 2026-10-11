import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import { useState } from 'react';
import { LinkIcon } from 'lucide-react';
import { Accordion, Alert } from '@heroui/react';
import { Button } from '../../ui/button';
import { CopyButton, Frame, Toolbar, toolbarBtn } from './common';
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

function Leaf({ v }: Readonly<{ v: Json }>) {
  const [more, setMore] = useState(false);
  if (v === null) return <span className="italic text-muted-foreground">null</span>;
  if (typeof v === 'string') {
    const long = v.length > LONG && !more;
    return (
      <span className="whitespace-pre-wrap break-words text-foreground">
        &quot;{long ? v.slice(0, LONG) : v}&quot;
        {v.length > LONG ? <Button type="button" variant="link" size="xs" className="ml-1" onClick={() => setMore(m => !m)}>{more ? t('collapse') : t('… {n} more characters', { n: v.length - LONG })}</Button> : null}
      </span>
    );
  }
  return <span className="text-foreground">{JSON.stringify(v)}</span>;
}

/** Copy actions occupy their own row space; coarse pointers retain visible 44px targets. */
const touchBtn = `${toolbarBtn} pointer-coarse:size-11 pointer-coarse:justify-center pointer-coarse:px-0`;
function Actions({ value, path }: Readonly<{ value: Json; path: string }>) {
  return (
    <span className="ml-auto flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100">
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
    <Accordion hideSeparator expandedKeys={open ? [path] : []} onExpandedChange={keys => setOpen(keys.has(path))}>
      <Accordion.Item id={path}>
        <div className="group/row relative flex items-start gap-1">
          <Accordion.Heading className="min-w-0 flex-1">
            <Accordion.Trigger className="min-h-9 justify-start gap-1 px-1 py-1 font-mono text-xs pointer-coarse:min-h-11">
              <Accordion.Indicator className="ms-0 size-3.5" />
              <span className="min-w-0 break-words">{label}<span className="text-muted-foreground">{isArr ? '[' : '{'}{open ? '' : ` ${entries.length} ${isArr ? t('items') : t('keys')} ${isArr ? ']' : '}'}`}</span></span>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Actions value={v} path={path} />
        </div>
        <Accordion.Panel>
          <Accordion.Body className="ml-2 border-l px-0 pb-0 pl-3 font-mono text-xs text-foreground">
            {open ? <>
          {entries.length === 0 ? <div className="py-px pl-4 text-muted-foreground">{isArr ? t('empty array') : t('empty object')}</div> : null}
          {shown.map(([ck, cv]) => <Node key={ck} k={ck} v={cv} path={keyPath(path, ck)} depth={depth + 1} mode={mode} />)}
          {entries.length > limit ? (
            <Button type="button" variant="outline" size="xs" className="my-2 ml-4" onClick={() => setLimit(l => l + PAGE)}>{t('more {n} ({remaining} left)', { n: Math.min(PAGE, entries.length - limit), remaining: entries.length - limit })}</Button>
          ) : null}
          <div className="py-px pl-4 text-muted-foreground">{isArr ? ']' : '}'}</div>
            </> : null}
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

/** JSON literals are source data, independent of runtime status; invalid input retains the raw text. */
export function JsonView({ text }: Readonly<{ text: string }>) {
  const [mode, setMode] = useState<Mode>({ m: 'default', n: 0 });
  const [raw, setRaw] = useState(false);
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return (
      <div className="space-y-2">
        <Alert status="warning"><Alert.Content><Alert.Description>{t('Not valid JSON ({error}). Shown as text.', { error: parsed.error })}</Alert.Description></Alert.Content></Alert>
        <TextView text={text} query="" />
      </div>
    );
  }
  const single = !parsed.jsonl;
  return (
    <Frame className="evidence-code-frame">
      <Toolbar right={<span>{parsed.jsonl ? t('JSONL · {n} lines', { n: parsed.docs.length }) : 'JSON'}</span>}>
        {!raw ? <>
          <Button type="button" variant="outline" size="xs" onClick={() => setMode(s => ({ m: 'all', n: s.n + 1 }))}>{t('Expand all')}</Button>
          <Button type="button" variant="outline" size="xs" onClick={() => setMode(s => ({ m: 'none', n: s.n + 1 }))}>{t('Collapse all')}</Button>
        </> : null}
        <Button type="button" variant="outline" size="xs" aria-pressed={raw} onClick={() => setRaw(r => !r)}>{raw ? t('View tree') : t('View raw')}</Button>
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
