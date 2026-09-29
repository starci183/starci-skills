import type { CSSProperties } from 'react';
import type { AgentFamily } from '../../contract';
import type { Concept } from '../concept';
import claudeSvg from './logos/claude.svg?raw';
import openaiSvg from './logos/openai.svg?raw';
import devinPng from './logos/devin.png';

export const concept: Concept = 'C6';

// Official marks, bundled with the app (no runtime fetch):
// claude.svg, openai.svg — simple-icons 13.21.0 (CC0-1.0, jsDelivr), downloaded 2026-09-29;
// devin.png — the 48 px image inside https://devin.ai/favicon.ico, downloaded 2026-09-29.
// Only the vetted <path d> data is rendered; the SVG text is never injected as HTML.
const pathsOf = (svg: string) => [...svg.matchAll(/\sd="([^"]+)"/g)].map(match => match[1]);
const marks = { claude: pathsOf(claudeSvg), codex: pathsOf(openaiSvg) } as const;

function PathMark({ paths, fill }: { paths: readonly string[]; fill: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full" style={{ fill }}>{paths.map((d, i) => <path key={i} d={d} />)}</svg>;
}

/** The agent family's official mark (the runtime has exactly Claude, Codex and Devin); unknown falls back to a letter. */
export function AgentMark({ family, initial = '?' }: { family: AgentFamily; initial?: string }) {
  switch (family) {
    case 'claude': return <PathMark paths={marks.claude} fill="var(--brand-claude)" />;
    case 'codex': return <PathMark paths={marks.codex} fill="var(--foreground)" />;
    case 'devin': return <img src={devinPng} alt="" aria-hidden="true" className="size-full rounded-full object-cover" draggable={false} />;
    default:
      return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full"><text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" style={{ fill: 'currentColor' }} fontFamily="var(--font-mono, monospace)">{initial}</text></svg>;
  }
}

export const familyTint: Record<AgentFamily, { name: string; tone: string }> = {
  claude: { name: 'Claude', tone: 'neutral' },
  codex: { name: 'Codex', tone: 'neutral' },
  devin: { name: 'Devin', tone: 'neutral' },
  unknown: { name: 'Chưa rõ', tone: 'skipped' },
};

/** Logos sit on a plain card-coloured circle so the brand colours read as-is in both themes. */
export const tintStyle = (tone: string): CSSProperties => tone === 'neutral'
  ? { color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--card)' }
  : tone === 'primary'
    ? { color: 'var(--primary)', borderColor: 'color-mix(in oklab, var(--primary) 40%, transparent)', background: 'color-mix(in oklab, var(--primary) 12%, transparent)' }
    : { color: `var(--status-${tone})`, borderColor: `var(--status-${tone}-line)`, background: tone === 'skipped' ? 'var(--muted)' : `var(--status-${tone}-bg)` };
