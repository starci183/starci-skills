import type { Concept } from '../../concept';
/** Names the C8 evidence concept this module belongs to, for the YAML renderer. */
export const concept: Concept = 'C8';
import type { ReactNode } from 'react';
import { CopyButton, Frame, Line, Toolbar } from './common';
import { TextView } from './text-view';
import { t } from '../../../i18n/t';

const NUM_RES: readonly RegExp[] = [
  /^[-+]?\d[\d_]*(?:\.\d*)?(?:[eE][-+]?\d+)?$/,
  /^[-+]?0x[0-9a-fA-F]+$/,
  /^[-+]?\.\d+$/,
];

const isSpace = (c: string): boolean => c !== '' && c.trim() === '';

/** Index just past the closing quote of a quoted key starting at 0, or -1. Double quotes honour backslash escapes. */
const quotedKeyEnd = (rest: string, quote: string): number => {
  for (let i = 1; i < rest.length; i++) {
    const c = rest.charAt(i);
    if (quote === '"' && c === '\\') { i += 1; continue; }
    if (c === quote) return i + 1;
  }
  return -1;
};

/** End of an unquoted key: it stops before the first colon and may not contain a comment mark. */
const plainKeyEnd = (rest: string): number => {
  if (/[\s:#"'[\]{},&*!|>%@`]/.test(rest.charAt(0))) return -1;
  const colon = rest.indexOf(':', 1);
  if (colon < 0 || rest.slice(1, colon).includes('#')) return -1;
  return rest.slice(0, colon).trimEnd().length;
};

type KeyMatch = { key: string; gap: string; length: number };

/** `key:` (quoted or plain) followed by whitespace or the end of the line. */
const matchKey = (rest: string): KeyMatch | null => {
  const first = rest.charAt(0);
  const keyEnd = first === '"' || first === "'" ? quotedKeyEnd(rest, first) : plainKeyEnd(rest);
  if (keyEnd < 0) return null;
  let colon = keyEnd;
  while (isSpace(rest.charAt(colon))) colon += 1;
  if (rest.charAt(colon) !== ':') return null;
  const after = rest.charAt(colon + 1);
  if (after !== '' && !isSpace(after)) return null;
  return { key: rest.slice(0, keyEnd), gap: rest.slice(keyEnd, colon), length: colon + 1 };
};

/** An anchor, alias or tag (`&a`, `*a`, `!!str`), the whitespace after it, and the rest of the value. */
const splitMeta = (v: string): { tag: string; space: string; value: string } | null => {
  if (!'&*!'.includes(v.charAt(0)) || v === '') return null;
  let end = 1;
  while (end < v.length && !isSpace(v.charAt(end))) end += 1;
  let rest = end;
  while (isSpace(v.charAt(rest))) rest += 1;
  return { tag: v.slice(0, end), space: v.slice(end, rest), value: v.slice(rest) };
};

/** Index of a trailing " #comment" that is outside quotes, or -1. */
const commentAt = (s: string): number => {
  let q = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (q) {
      if (c === q && s.charAt(i - 1) !== '\\') q = '';
      continue;
    }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '#' && (i === 0 || isSpace(s.charAt(i - 1)))) return i;
  }
  return -1;
};

const muted = 'text-muted-foreground';

const scalar = (raw: string, k: string): { node: ReactNode; block: boolean } => {
  const v = raw.trim();
  if (!v) return { node: null, block: false };
  if (/^[|>][+-]?\d?$/.test(v)) return { node: <span key={k} className={muted}>{v}</span>, block: true };
  const meta = splitMeta(v);
  if (meta) {
    const rest = scalar(meta.value, `${k}r`);
    return { node: <span key={k}><span className="text-foreground">{meta.tag}</span>{meta.space}{rest.node}</span>, block: rest.block };
  }
  if (v.startsWith('"') || v.startsWith("'")) return { node: <span key={k} className="text-foreground">{v}</span>, block: false };
  if (v.startsWith('[') || v.startsWith('{')) return { node: <span key={k} className="text-foreground">{v}</span>, block: false };
  if (NUM_RES.some(re => re.test(v))) return { node: <span key={k} className="text-foreground">{v}</span>, block: false };
  if (/^(true|false|null|~|yes|no)$/i.test(v)) {
    return { node: <span key={k} className={/^(null|~)$/i.test(v) ? 'italic text-muted-foreground' : 'text-foreground'}>{v}</span>, block: false };
  }
  return { node: <span key={k} className="text-foreground">{v}</span>, block: false };
};

const tokenize = (line: string): { nodes: ReactNode[]; block: boolean } => {
  const trimmed = line.trim();
  const indent = line.slice(0, line.length - line.trimStart().length);
  if (!trimmed) return { nodes: [' '], block: false };
  if (trimmed.startsWith('#')) return { nodes: [indent, <span key="c" className={`italic ${muted}`}>{trimmed}</span>], block: false };
  if (trimmed === '---' || trimmed === '...') return { nodes: [<span key="d" className={muted}>{line}</span>], block: false };
  const nodes: ReactNode[] = [indent];
  let rest = trimmed;
  let n = 0;
  for (;;) {
    const m = /^-(\s+|$)/.exec(rest);
    if (!m) break;
    nodes.push(<span key={`d${n++}`} className="font-bold text-primary">-</span>, m[1]);
    rest = rest.slice(m[0].length);
  }
  let comment = '';
  const ci = commentAt(rest);
  if (ci >= 0) { comment = rest.slice(ci); rest = rest.slice(0, ci); }
  const trailing = rest.slice(rest.trimEnd().length);
  rest = rest.slice(0, rest.length - trailing.length);
  let block = false;
  const km = matchKey(rest);
  if (km) {
    nodes.push(<span key="k" className="font-medium text-foreground/80">{km.key}</span>, km.gap, <span key="col" className={muted}>:</span>);
    const val = rest.slice(km.length);
    const lead = val.slice(0, val.length - val.trimStart().length);
    const s = scalar(val, 'v');
    nodes.push(lead, s.node);
    block = s.block;
  } else {
    const s = scalar(rest, 'v');
    nodes.push(s.node);
    block = s.block;
  }
  nodes.push(trailing);
  if (comment) nodes.push(<span key="cm" className={`italic ${muted}`}>{comment}</span>);
  return { nodes, block };
};

/** Numbered rows; a block scalar (`|`, `>`) keeps every following more-indented or blank line as plain text. */
const yamlRows = (lines: readonly string[]): ReactNode[] => {
  const rows: ReactNode[] = [];
  let block: number | null = null;
  for (const [i, line] of lines.entries()) {
    const indent = line.length - line.trimStart().length;
    if (block !== null && (!line.trim() || indent > block)) {
      rows.push(<Line key={`${i + 1}-${line}`} n={i + 1}><span className="text-foreground/90">{line || ' '}</span></Line>);
      continue;
    }
    block = null;
    const tokens = tokenize(line);
    if (tokens.block) block = indent;
    rows.push(<Line key={`${i + 1}-${line}`} n={i + 1}>{tokens.nodes}</Line>);
  }
  return rows;
};

/** YAML with line numbers and neutral syntax; source literals do not establish runtime status. */
export const YamlView = ({ text }: Readonly<{ text: string }>) => {
  const src = text.replaceAll(/^﻿/g, '').replaceAll(/\r\n/g, '\n');
  const lines = src.split('\n');
  if (lines.length > 5000) return <TextView text={text} query="" />;
  const rows = yamlRows(lines);
  return (
    <Frame className="evidence-code-frame">
      <Toolbar right={<span>{t('YAML · {n} lines', { n: lines.length })}</span>}><CopyButton value={text} label={t('Copy all')} /></Toolbar>
      <div className="max-h-[70vh] overflow-auto bg-background py-1">{rows}</div>
    </Frame>
  );
};
