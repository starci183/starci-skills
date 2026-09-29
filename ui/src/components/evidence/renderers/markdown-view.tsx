import type { Concept } from '../../concept';
export const concept: Concept = 'C8';
import type { ReactNode } from 'react';
import { CopyButton, Frame } from './common';

const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\s][^*\n]*\*|\b_[^_\n]+_\b)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<>)]+)/g;

const safeHref = (h: string) => /^https?:\/\//i.test(h) ? h : null;

function Link({ href, children }: { href: string; children: ReactNode }) {
  const ok = safeHref(href);
  if (!ok) return <>{children}</>;
  return <a href={ok} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 break-words">{children}</a>;
}

function inline(text: string, base = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0; let n = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > at) out.push(text.slice(at, idx));
    const k = `${base}${n++}`;
    const s = m[0];
    if (m[1]) out.push(<code key={k} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{s.slice(1, -1)}</code>);
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

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between border-b bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
        <span className="font-mono">{lang || 'code'}</span>
        <CopyButton value={code} label="Chép" />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-5"><code>{code}</code></pre>
    </div>
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
      out.push(<div key={k} role="heading" aria-level={lvl} className={`${cls} mt-2`}>{inline(h[2], k)}</div>);
      i++; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push(<hr key={k} className="my-2 border-border" />); i++; continue; }
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
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
      out.push(
        <div key={k} className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-muted/60"><tr>{head.map((c, j) => <th key={j} style={{ textAlign: aligns[j] as 'left' }} className="border-b px-2 py-1.5 font-semibold">{inline(c, `${k}h${j}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri} className="border-b last:border-0">{head.map((_, j) => <td key={j} style={{ textAlign: aligns[j] as 'left' }} className="px-2 py-1 align-top">{inline(r[j] ?? '', `${k}r${ri}c${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (LIST_RE.test(l)) {
      const items: { depth: number; ordered: boolean; num: string; text: string }[] = [];
      while (i < lines.length) {
        const m = LIST_RE.exec(lines[i]);
        if (m) { items.push({ depth: Math.floor(m[1].replace(/\t/g, '  ').length / 2), ordered: /\d/.test(m[2]), num: m[2], text: m[3] }); i++; }
        else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1].text += ` ${lines[i].trim()}`; i++; }
        else break;
      }
      out.push(
        <ul key={k} className="space-y-0.5">
          {items.map((it, j) => (
            <li key={j} style={{ marginLeft: it.depth * 16 }} className="flex gap-2">
              <span className="w-5 shrink-0 text-right text-muted-foreground">{it.ordered ? it.num : '•'}</span>
              <span className="min-w-0 break-words">{inline(it.text, `${k}l${j}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|#{1,6}\s|>|([-*_])(\s*\2){2,}\s*$)/.test(lines[i]) && !LIST_RE.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isSep(lines[i + 1]))) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    out.push(<p key={k} className="break-words leading-6">{buf.map((b, j) => <span key={j}>{j ? <br /> : null}{inline(b.trim(), `${k}p${j}`)}</span>)}</p>);
  }
  return out;
}

/** Small safe markdown renderer (React nodes only, http(s) links only). */
export function MarkdownView({ text }: { text: string }) {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  return (
    <Frame>
      <div className="flex justify-end border-b bg-muted/40 px-2 py-1.5"><CopyButton value={text} label="Chép nguồn" /></div>
      <div className="max-h-[75vh] space-y-2 overflow-auto bg-background p-4 text-sm">{blocks(src, '')}</div>
    </Frame>
  );
}
