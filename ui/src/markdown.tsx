import type { ReactNode } from 'react';

// A deliberately small markdown renderer for decision and narration rows: headings, lists, fenced code, quotes and
// paragraphs, with inline code, bold, italic and http(s) links. It builds React nodes - never HTML strings - so a
// log row cannot inject markup.
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0, i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<code key={k} className="rounded bg-zinc-800 px-1 py-px font-mono text-[0.92em] text-amber-300">{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k} className="font-semibold text-zinc-100">{m[2].slice(2, -2)}</strong>);
    else if (m[3]) out.push(<em key={k}>{m[3].slice(1, -1)}</em>);
    else if (m[4]) out.push(<a key={k} href={m[5]} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2">{m[4].slice(1, m[4].indexOf(']'))}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;
    if (/^```/.test(line)) {
      const body: string[] = [];
      for (i += 1; i < lines.length && !/^```/.test(lines[i]); i++) body.push(lines[i]);
      i += 1;
      blocks.push(<pre key={key} className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] leading-5 text-zinc-300">{body.join('\n')}</pre>);
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) { blocks.push(<div key={key} className={`font-semibold text-zinc-100 ${heading[1].length <= 2 ? 'text-sm' : 'text-xs'}`}>{inline(heading[2], key)}</div>); i += 1; continue; }
    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: ReactNode[] = [];
      for (; i < lines.length && /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i]); i++) items.push(<li key={`${key}-${i}`}>{inline(lines[i].replace(/^\s*(?:[-*+]|\d+\.)\s+/, ''), `${key}-${i}`)}</li>);
      blocks.push(ordered ? <ol key={key} className="list-decimal space-y-0.5 pl-5">{items}</ol> : <ul key={key} className="list-disc space-y-0.5 pl-5">{items}</ul>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) quote.push(lines[i].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key} className="border-l-2 border-zinc-700 pl-3 text-zinc-400">{inline(quote.join(' '), key)}</blockquote>);
      continue;
    }
    if (!line.trim()) { i += 1; continue; }
    const para: string[] = [];
    for (; i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*(?:[-*+]|\d+\.)\s|>)/.test(lines[i]); i++) para.push(lines[i]);
    if (!para.length) { i += 1; continue; }
    blocks.push(<p key={key}>{inline(para.join(' '), key)}</p>);
  }
  return <div className={`space-y-1.5 break-words text-xs leading-5 text-zinc-300 ${className}`}>{blocks}</div>;
}
