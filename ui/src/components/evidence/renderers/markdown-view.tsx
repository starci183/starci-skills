import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import type { ReactNode } from 'react';
import { Card, Link as HeroLink, Separator, Table } from '@heroui/react';
import { CopyButton, Frame } from './common';
import { t } from '../../../i18n/t';

const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\s][^*\n]*\*|\b_[^_\n]+_\b)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<>)]+)/g;

const safeHref = (h: string) => /^https?:\/\//i.test(h) ? h : null;

function Link({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
  const ok = safeHref(href);
  if (!ok) return <>{children}</>;
  return <HeroLink href={ok} target="_blank" rel="noopener noreferrer" className="break-words">{children}</HeroLink>;
}

function inline(text: string, base = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0; let n = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > at) out.push(text.slice(at, idx));
    const k = `${base}${n++}`;
    const s = m[0];
    if (m[1]) out.push(<code key={k} className="rounded bg-default px-1 py-0.5 font-mono text-[0.85em]">{s.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(s.slice(2, -2), k)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(s.slice(1, -1), k)}</em>);
    else if (m[4]) { const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s); if (lm) out.push(<Link key={k} href={lm[2]}>{inline(lm[1], k)}</Link>); else out.push(s); }
    else if (m[5]) { const url = s.replace(/[.,;:!?]+$/, ''); out.push(<Link key={k} href={url}>{url}</Link>, s.slice(url.length)); }
    at = idx + s.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

const splitRow = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
const isSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-');
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

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

function blocks(src: string, base: string): ReactNode[] {
  const lines = src.split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    const k = `${base}b${i}`;
    if (!l.trim()) { i++; continue; }
    const fence = /^\s*(```+|~~~+)\s*([\w+-]*)/.exec(l);
    if (fence) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) buf.push(lines[i++]);
      i++;
      out.push(<CodeBlock key={k} code={buf.join('\n')} lang={fence[2]} />);
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
    if (h) {
      const lvl = h[1].length;
      const cls = ['text-xl font-semibold', 'text-lg font-semibold border-b pb-1', 'text-base font-semibold', 'text-sm font-semibold', 'text-sm font-medium', 'text-xs font-medium text-muted-foreground'][lvl - 1];
      const Tag = `h${lvl}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      out.push(<Tag key={k} className={`${cls} mt-2`}>{inline(h[2], k)}</Tag>);
      i++; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push(<Separator key={k} className="my-2" />); i++; continue; }
    if (/^\s*>/.test(l)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(<blockquote key={k} className="space-y-2 border-l-4 border-border pl-3 text-muted-foreground">{blocks(buf.join('\n'), k)}</blockquote>);
      continue;
    }
    if (l.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = splitRow(l);
      const aligns = splitRow(lines[i + 1]).map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left');
      i += 2;
      type Cell = { key: string; text: string; align: 'left' | 'center' | 'right' };
      const cols: Cell[] = head.map((c, j) => ({ key: `${k}h${j}`, text: c, align: aligns[j] as Cell['align'] }));
      const rows: { key: string; cells: Cell[] }[] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const line = i;
        const texts = splitRow(lines[i++]);
        rows.push({ key: `${k}r${line}`, cells: head.map((_, j) => ({ key: `${k}r${line}c${j}`, text: texts[j] ?? '', align: aligns[j] as Cell['align'] })) });
      }
      out.push(
        <Table key={k} className="text-xs">
          <Table.ScrollContainer>
            <Table.Content aria-label={head.filter(Boolean).join(' · ') || t('Evidence')}>
              <Table.Header>{cols.map((col, index) => <Table.Column key={col.key} id={col.key} isRowHeader={index === 0} style={{ textAlign: col.align }}>{inline(col.text, col.key)}</Table.Column>)}</Table.Header>
              <Table.Body>{rows.map(row => <Table.Row key={row.key} id={row.key}>{row.cells.map(cell => <Table.Cell key={cell.key} style={{ textAlign: cell.align }} className="whitespace-normal align-top">{inline(cell.text, cell.key)}</Table.Cell>)}</Table.Row>)}</Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>,
      );
      continue;
    }
    if (LIST_RE.test(l)) {
      const items: { key: string; depth: number; ordered: boolean; num: string; text: string }[] = [];
      while (i < lines.length) {
        const m = LIST_RE.exec(lines[i]);
        if (m) { items.push({ key: `${k}l${items.length}`, depth: Math.floor(m[1].replaceAll('\t', '  ').length / 2), ordered: /\d/.test(m[2]), num: m[2], text: m[3] }); i++; }
        else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) { items.at(-1)!.text += ` ${lines[i].trim()}`; i++; }
        else break;
      }
      out.push(
        <ul key={k} className="space-y-1">
          {items.map(it => (
            <li key={it.key} style={{ marginLeft: it.depth * 16 }} className="flex gap-2">
              <span className="w-5 shrink-0 text-right text-muted-foreground">{it.ordered ? it.num : '•'}</span>
              <span className="min-w-0 break-words">{inline(it.text, it.key)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    const buf: { key: string; text: string }[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|#{1,6}\s|>|([-*_])(\s*\2){2,}\s*$)/.test(lines[i]) && !LIST_RE.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isSep(lines[i + 1]))) { buf.push({ key: `${k}p${i}`, text: lines[i] }); i++; }
    if (!buf.length) { buf.push({ key: `${k}p${i}`, text: lines[i] }); i++; }
    out.push(<p key={k} className="break-words leading-6">{buf.map((b, j) => <span key={b.key}>{j ? <br /> : null}{inline(b.text.trim(), b.key)}</span>)}</p>);
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
