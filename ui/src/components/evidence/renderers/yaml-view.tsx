import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import type { ReactNode } from 'react';
import { CopyButton, Frame, Line, Toolbar, wordTone } from './common';
import { TextView } from './text-view';
import { t } from '../../../i18n/t';

const KEY_RE = /^("(?:[^"\\]|\\.)*"|'[^']*'|[^\s:#"'[\]{},&*!|>%@`][^:#]*?)(\s*):(?=\s|$)/;
const NUM_RE = /^[-+]?(?:\d[\d_]*(?:\.\d*)?(?:[eE][-+]?\d+)?|0x[0-9a-fA-F]+|\.\d+)$/;

/** Index of a trailing " #comment" that is outside quotes, or -1. */
function commentAt(s: string): number {
  let q = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q && s[i - 1] !== '\\') q = ''; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return i;
  }
  return -1;
}

const muted = 'text-muted-foreground';

function scalar(raw: string, k: string): { node: ReactNode; block: boolean } {
  const v = raw.trim();
  if (!v) return { node: null, block: false };
  if (/^[|>][+-]?\d?$/.test(v)) return { node: <span key={k} className={muted}>{v}</span>, block: true };
  const meta = /^([&*!][^\s]*)(\s+)?(.*)$/.exec(v);
  if (meta) {
    const rest = scalar(meta[3], `${k}r`);
    return { node: <span key={k}><span className="text-[var(--status-warning)]">{meta[1]}</span>{meta[2] ?? ''}{rest.node}</span>, block: rest.block };
  }
  if (v.startsWith('"') || v.startsWith("'")) return { node: <span key={k} className="text-foreground">{v}</span>, block: false };
  if (v.startsWith('[') || v.startsWith('{')) return { node: <span key={k} className="text-foreground">{v}</span>, block: false };
  if (NUM_RE.test(v)) return { node: <span key={k} data-tone="running" className="text-[var(--tone)]">{v}</span>, block: false };
  if (/^(true|false|null|~|yes|no)$/i.test(v)) {
    const tone = /^true$/i.test(v) ? 'success' : /^false$/i.test(v) ? 'failed' : null;
    return { node: <span key={k} data-tone={tone ?? undefined} className={tone ? 'font-medium text-[var(--tone)]' : 'italic text-muted-foreground'}>{v}</span>, block: false };
  }
  const tone = wordTone(v);
  if (tone) return { node: <span key={k} data-tone={tone} className="font-medium text-[var(--tone)]">{v}</span>, block: false };
  return { node: <span key={k} className="text-foreground">{v}</span>, block: false };
}

function tokenize(line: string): { nodes: ReactNode[]; block: boolean } {
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
  const trailing = /\s*$/.exec(rest)?.[0] ?? '';
  rest = rest.slice(0, rest.length - trailing.length);
  let block = false;
  const km = KEY_RE.exec(rest);
  if (km) {
    nodes.push(<span key="k" className="font-medium text-foreground/80">{km[1]}</span>, km[2], <span key="col" className={muted}>:</span>);
    const val = rest.slice(km[0].length);
    const lead = /^\s*/.exec(val)?.[0] ?? '';
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
}

/** YAML with line numbers and light highlighting. Outcome values (pass/fail/blocked/done…) take status tones. */
export function YamlView({ text }: Readonly<{ text: string }>) {
  const src = text.replaceAll(/^﻿/g, '').replaceAll(/\r\n/g, '\n');
  const lines = src.split('\n');
  if (lines.length > 5000) return <TextView text={text} query="" />;
  let block: number | null = null;
  const rows = lines.map((line, i) => {
    const indent = line.length - line.trimStart().length;
    if (block !== null) {
      if (!line.trim() || indent > block) return <Line key={`${i + 1}-${line}`} n={i + 1}><span className="text-foreground/90">{line || ' '}</span></Line>;
      block = null;
    }
    const t = tokenize(line);
    if (t.block) block = indent;
    return <Line key={`${i + 1}-${line}`} n={i + 1}>{t.nodes}</Line>;
  });
  return (
    <Frame className="evidence-code-frame">
      <Toolbar right={<span>{t('YAML · {n} lines', { n: lines.length })}</span>}><CopyButton value={text} label={t('Copy all')} /></Toolbar>
      <div className="max-h-[70vh] overflow-auto bg-background py-1">{rows}</div>
    </Frame>
  );
}
