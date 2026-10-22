import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import type { ReactNode } from 'react';
import { Card, Link as HeroLink, Separator, Table } from '@heroui/react';
import { CopyButton, Frame } from './common';
import { t } from '../../../i18n/t';

type Found = { index: number; text: string };

const regexFinder = (re: RegExp) => (text: string, at: number): Found | null => {
  re.lastIndex = at;
  const m = re.exec(text);
  return m ? { index: m.index, text: m[0] } : null;
};

/** `[label](url)`: a label of one or more characters up to the first `]` on the line, then a url with no space or `)`. */
function findMarkdownLink(text: string, at: number): Found | null {
  let boundary = -1;
  for (let start = text.indexOf('[', at); start >= 0; start = text.indexOf('[', start + 1)) {
    if (start >= boundary) {
      boundary = start + 1;
      while (boundary < text.length && text.charAt(boundary) !== ']' && text.charAt(boundary) !== '\n') boundary += 1;
    }
    if (boundary === start + 1 || text.charAt(boundary) !== ']' || text.charAt(boundary + 1) !== '(') continue;
    let end = boundary + 2;
    while (end < text.length && text.charAt(end) !== ')' && !/\s/.test(text.charAt(end))) end += 1;
    if (end > boundary + 2 && text.charAt(end) === ')') return { index: start, text: text.slice(start, end + 1) };
  }
  return null;
}

/** Inline constructs in priority order: code, bold, italic, link, bare URL. At one position the first rule wins. */
const INLINE_RULES: readonly ((text: string, at: number) => Found | null)[] = [
  regexFinder(/`[^`\n]+`/g),
  regexFinder(/\*\*[^*\n]+\*\*|__[^_\n]+__/g),
  regexFinder(/\*[^*\s][^*\n]*\*|\b_[^_\n]+_\b/g),
  findMarkdownLink,
  regexFinder(/https?:\/\/[^\s<>)]+/g),
];
const CODE = 0;
const STRONG = 1;
const EM = 2;
const MD_LINK = 3;

const safeHref = (h: string) => /^https?:\/\//i.test(h) ? h : null;

function Link({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
  const ok = safeHref(href);
  if (!ok) return <>{children}</>;
  return <HeroLink href={ok} target="_blank" rel="noopener noreferrer" className="break-words">{children}</HeroLink>;
}

type InlineHit = Found & { rule: number };
type MatchCache = (Found | null | undefined)[];

/** The leftmost inline construct starting at or after `at`; each rule's next match is cached until it is passed. */
function nextInline(text: string, at: number, cache: MatchCache): InlineHit | null {
  let best: InlineHit | null = null;
  for (const [rule, find] of INLINE_RULES.entries()) {
    let m = cache[rule];
    if (m === undefined || (m !== null && m.index < at)) {
      m = find(text, at);
      cache[rule] = m;
    }
    if (m && (!best || m.index < best.index)) best = { rule, index: m.index, text: m.text };
  }
  return best;
}

function trimTrailingPunctuation(url: string): string {
  let end = url.length;
  while (end > 0 && '.,;:!?'.includes(url.charAt(end - 1))) end -= 1;
  return url.slice(0, end);
}

function renderMarkdownLink(s: string, k: string): ReactNode[] {
  const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s);
  const label = lm?.[1];
  const href = lm?.[2];
  if (label === undefined || href === undefined) return [s];
  return [<Link key={k} href={href}>{inline(label, k)}</Link>];
}

function renderInlineHit(hit: InlineHit, k: string): ReactNode[] {
  const s = hit.text;
  switch (hit.rule) {
    case CODE: return [<code key={k} className="rounded bg-default px-1 py-0.5 font-mono text-[0.85em]">{s.slice(1, -1)}</code>];
    case STRONG: return [<strong key={k}>{inline(s.slice(2, -2), k)}</strong>];
    case EM: return [<em key={k}>{inline(s.slice(1, -1), k)}</em>];
    case MD_LINK: return renderMarkdownLink(s, k);
    default: {
      const url = trimTrailingPunctuation(s);
      return [<Link key={k} href={url}>{url}</Link>, s.slice(url.length)];
    }
  }
}

function inline(text: string, base = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  const cache: MatchCache = [];
  let at = 0; let n = 0;
  for (let hit = nextInline(text, at, cache); hit; hit = nextInline(text, at, cache)) {
    if (hit.index > at) out.push(text.slice(at, hit.index));
    out.push(...renderInlineHit(hit, `${base}${n}`));
    n += 1;
    at = hit.index + hit.text.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

const splitRow = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
/** A table delimiter row: every cell is two or more dashes with optional alignment colons. */
const isSep = (l: string) => splitRow(l).every(cell => /^:?-{2,}:?$/.test(cell));

type ListMatch = { indent: string; marker: string; text: string };

/** `  - item`, `1. item` or `2) item`: indent, marker and the text after the whitespace that follows it. */
function parseListItem(line: string): ListMatch | null {
  const body = line.trimStart();
  const indent = line.slice(0, line.length - body.length);
  let end = 0;
  if ('-*+'.includes(body.charAt(0)) && body.length > 0) end = 1;
  else {
    while (end < body.length && body.charAt(end) >= '0' && body.charAt(end) <= '9') end += 1;
    if (end === 0 || !'.)'.includes(body.charAt(end)) || end >= body.length) return null;
    end += 1;
  }
  const afterMarker = body.slice(end);
  const text = afterMarker.trimStart();
  if (text.length === afterMarker.length) return null;
  return { indent, marker: body.slice(0, end), text };
}

/** `## Title ##`: heading level and the title without the closing hashes. */
function parseHeading(line: string): { level: number; title: string } | null {
  let level = 0;
  while (line.charAt(level) === '#') level += 1;
  if (level < 1 || level > 6 || line.slice(level).trimStart().length === line.length - level) return null;
  const rest = line.slice(level).trimStart();
  let end = rest.length;
  while (end > 0 && rest.charAt(end - 1).trim() === '') end -= 1;
  while (end > 0 && rest.charAt(end - 1) === '#') end -= 1;
  while (end > 0 && rest.charAt(end - 1).trim() === '') end -= 1;
  return { level, title: rest.slice(0, end) };
}

function CodeBlock({ code, lang }: Readonly<{ code: string; lang: string }>) {
  return (
    <Card variant="transparent" className="evidence-code-frame gap-0 overflow-hidden p-0">
      <Card.Header className="flex-row items-center justify-between border-b bg-default/60 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-mono">{lang || 'code'}</span>
        <CopyButton value={code} label={t('Copy')} />
      </Card.Header>
      <Card.Content><pre className="overflow-x-auto p-4 font-mono text-xs leading-5"><code>{code}</code></pre></Card.Content>
    </Card>
  );
}

type Parsed = { node: ReactNode; next: number } | null;
type Align = 'left' | 'center' | 'right';
type Cell = { key: string; text: string; align: Align | undefined };

const HEADING_CLASSES = ['text-xl font-semibold', 'text-lg font-semibold border-b pb-1', 'text-base font-semibold', 'text-sm font-semibold', 'text-sm font-medium', 'text-xs font-medium text-muted-foreground'] as const;
const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

function parseFence(lines: readonly string[], i: number, k: string): Parsed {
  const fence = /^\s*(```+|~~~+)\s*([\w+-]*)/.exec(lines[i] ?? '');
  if (!fence) return null;
  const [, marker = '', lang = ''] = fence;
  const buf: string[] = [];
  let next = i + 1;
  while (next < lines.length && !(lines[next] ?? '').trim().startsWith(marker)) { buf.push(lines[next] ?? ''); next += 1; }
  return { node: <CodeBlock key={k} code={buf.join('\n')} lang={lang} />, next: next + 1 };
}

function parseHeadingBlock(lines: readonly string[], i: number, k: string): Parsed {
  const h = parseHeading(lines[i] ?? '');
  if (!h) return null;
  const Tag = HEADING_TAGS[h.level - 1] ?? 'h6';
  return { node: <Tag key={k} className={`${HEADING_CLASSES[h.level - 1] ?? ''} mt-2`}>{inline(h.title, k)}</Tag>, next: i + 1 };
}

function parseRule(lines: readonly string[], i: number, k: string): Parsed {
  return /^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i] ?? '') ? { node: <Separator key={k} className="my-2" />, next: i + 1 } : null;
}

function parseQuote(lines: readonly string[], i: number, k: string): Parsed {
  if (!/^\s*>/.test(lines[i] ?? '')) return null;
  const buf: string[] = [];
  let next = i;
  while (next < lines.length && /^\s*>/.test(lines[next] ?? '')) { buf.push((lines[next] ?? '').replace(/^\s*>\s?/, '')); next += 1; }
  return { node: <blockquote key={k} className="space-y-2 border-l-4 border-border pl-3 text-muted-foreground">{blocks(buf.join('\n'), k)}</blockquote>, next };
}

function columnAlign(cell: string): Align {
  if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
  return cell.endsWith(':') ? 'right' : 'left';
}

function TableBlock({ cols, rows, label }: Readonly<{ cols: Cell[]; rows: { key: string; cells: Cell[] }[]; label: string }>) {
  return (
    <Table className="text-xs">
      <Table.ScrollContainer>
        <Table.Content aria-label={label}>
          <Table.Header>{cols.map((col, index) => <Table.Column key={col.key} id={col.key} isRowHeader={index === 0} style={{ textAlign: col.align }}>{inline(col.text, col.key)}</Table.Column>)}</Table.Header>
          <Table.Body>{rows.map(row => <Table.Row key={row.key} id={row.key}>{row.cells.map(cell => <Table.Cell key={cell.key} style={{ textAlign: cell.align }} className="whitespace-normal align-top">{inline(cell.text, cell.key)}</Table.Cell>)}</Table.Row>)}</Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function parseTable(lines: readonly string[], i: number, k: string): Parsed {
  const l = lines[i] ?? '';
  const delimiter = lines[i + 1];
  if (!l.includes('|') || delimiter === undefined || !isSep(delimiter)) return null;
  const head = splitRow(l);
  const aligns = splitRow(delimiter).map(columnAlign);
  const cols: Cell[] = head.map((c, j) => ({ key: `${k}h${j}`, text: c, align: aligns[j] }));
  const rows: { key: string; cells: Cell[] }[] = [];
  let next = i + 2;
  while (next < lines.length && (lines[next] ?? '').trim() && (lines[next] ?? '').includes('|')) {
    const line = next;
    const texts = splitRow(lines[line] ?? '');
    rows.push({ key: `${k}r${line}`, cells: head.map((_, j) => ({ key: `${k}r${line}c${j}`, text: texts[j] ?? '', align: aligns[j] })) });
    next += 1;
  }
  return { node: <TableBlock key={k} cols={cols} rows={rows} label={head.filter(Boolean).join(' · ') || t('Evidence')} />, next };
}

type ListItem = { key: string; depth: number; ordered: boolean; num: string; text: string };

function parseList(lines: readonly string[], i: number, k: string): Parsed {
  if (parseListItem(lines[i] ?? '') === null) return null;
  const items: ListItem[] = [];
  let next = i;
  while (next < lines.length) {
    const line = lines[next] ?? '';
    const m = parseListItem(line);
    const last = items.at(-1);
    if (m) items.push({ key: `${k}l${items.length}`, depth: Math.floor(m.indent.replaceAll('\t', '  ').length / 2), ordered: /\d/.test(m.marker), num: m.marker, text: m.text });
    else if (last && line.trim() && /^\s{2,}\S/.test(line)) last.text += ` ${line.trim()}`;
    else break;
    next += 1;
  }
  const node = (
    <ul key={k} className="space-y-1">
      {items.map(it => (
        <li key={it.key} style={{ marginLeft: it.depth * 16 }} className="flex gap-2">
          <span className="w-5 shrink-0 text-right text-muted-foreground">{it.ordered ? it.num : '•'}</span>
          <span className="min-w-0 break-words">{inline(it.text, it.key)}</span>
        </li>
      ))}
    </ul>
  );
  return { node, next };
}

/** True when the line begins another block kind, ending a paragraph. */
function startsBlock(lines: readonly string[], i: number): boolean {
  const line = lines[i] ?? '';
  if (/^\s*(```|~~~|#{1,6}\s|>|([-*_])(\s*\2){2,}\s*$)/.test(line) || parseListItem(line) !== null) return true;
  const delimiter = lines[i + 1];
  return line.includes('|') && delimiter !== undefined && isSep(delimiter);
}

function parseParagraph(lines: readonly string[], i: number, k: string): { node: ReactNode; next: number } {
  const buf: { key: string; text: string }[] = [];
  let next = i;
  while (next < lines.length && (lines[next] ?? '').trim() && !startsBlock(lines, next)) { buf.push({ key: `${k}p${next}`, text: lines[next] ?? '' }); next += 1; }
  if (!buf.length) { buf.push({ key: `${k}p${next}`, text: lines[next] ?? '' }); next += 1; }
  return { node: <p key={k} className="break-words leading-6">{buf.map((b, j) => <span key={b.key}>{j ? <br /> : null}{inline(b.text.trim(), b.key)}</span>)}</p>, next };
}

const BLOCK_PARSERS = [parseFence, parseHeadingBlock, parseRule, parseQuote, parseTable, parseList] as const;

function parseBlock(lines: readonly string[], i: number, k: string): { node: ReactNode; next: number } {
  for (const parse of BLOCK_PARSERS) {
    const parsed = parse(lines, i, k);
    if (parsed) return parsed;
  }
  return parseParagraph(lines, i, k);
}

function blocks(src: string, base: string): ReactNode[] {
  const lines = src.split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!(lines[i] ?? '').trim()) { i += 1; continue; }
    const parsed = parseBlock(lines, i, `${base}b${i}`);
    out.push(parsed.node);
    i = parsed.next;
  }
  return out;
}

/** Small safe markdown renderer (React nodes only, http(s) links only). */
export function MarkdownView({ text }: Readonly<{ text: string }>) {
  const src = text.replace(/^﻿/, '').replaceAll(/\r\n?/g, '\n');
  return (
    <Frame>
      <Card.Header className="flex-row justify-end border-b bg-default/40 px-4 py-3"><CopyButton value={text} label={t('Copy source')} /></Card.Header>
      <Card.Content className="max-h-[75vh] space-y-4 overflow-auto bg-background p-4 text-sm">{blocks(src, '')}</Card.Content>
    </Frame>
  );
}
