import type { CSSProperties } from 'react';
import type { AgentFamily } from '../../contract';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';
import { MediaImage } from '../ui/media-image';
import claudeSvg from './logos/claude.svg?raw';
import openaiSvg from './logos/openai.svg?raw';
import devinPng from './logos/devin.png';

/** The business concept id (C6) under which the official agent family marks are filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C6';

// Official marks, bundled with the app (no runtime fetch):
// claude.svg, openai.svg — simple-icons 13.21.0 (CC0-1.0, jsDelivr), downloaded 2026-09-29;
// devin.png — the 48 px image inside https://devin.ai/favicon.ico, downloaded 2026-09-29.
// Only the vetted <path d> data is rendered; the SVG text is never injected as HTML.
const pathsOf = (svg: string) => [...svg.matchAll(/\sd="([^"]+)"/g)].flatMap(match => (match[1] === undefined ? [] : [match[1]]));
const marks = { claude: pathsOf(claudeSvg), codex: pathsOf(openaiSvg) } as const;

type PathMarkProps = { readonly paths: readonly string[]; readonly fill: string };

const PathMark = ({ paths, fill }: PathMarkProps) => {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full" style={{ fill }}>{paths.map(d => <path key={d} d={d} />)}</svg>;
};

type AgentMarkProps = { readonly family: AgentFamily; readonly initial?: string };

/** The agent family's official mark (the runtime has exactly Claude, Codex and Devin); unknown falls back to a letter. */
export const AgentMark = ({ family, initial = '?' }: AgentMarkProps) => {
  switch (family) {
    case 'claude': return <PathMark paths={marks.claude} fill="var(--brand-claude)" />;
    case 'codex': return <PathMark paths={marks.codex} fill="var(--foreground)" />;
    case 'devin': return <MediaImage src={devinPng} alt="" frameClassName="size-full" className="size-full rounded-full object-cover" draggable={false} />;
    case 'unknown':
      break;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full"><text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" style={{ fill: 'currentColor' }} fontFamily="var(--font-mono, monospace)">{initial}</text></svg>;
};

/** The display name and chip tone of each agent family, shared by the avatar, its tooltip and the legends. */
export const familyTint: Record<AgentFamily, { name: string; tone: string }> = {
  claude: { name: 'Claude', tone: 'neutral' },
  codex: { name: 'Codex', tone: 'neutral' },
  devin: { name: 'Devin', tone: 'neutral' },
  unknown: { name: t('Unknown'), tone: 'skipped' },
};

/** Logos sit on a plain card-coloured circle so the brand colours read as-is in both themes. */
export const tintStyle = (tone: string): CSSProperties => {
  if (tone === 'neutral') return { color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--card)' };
  if (tone === 'primary') return { color: 'var(--primary)', borderColor: 'color-mix(in oklab, var(--primary) 40%, transparent)', background: 'color-mix(in oklab, var(--primary) 12%, transparent)' };
  return { color: `var(--status-${tone})`, borderColor: `var(--status-${tone}-line)`, background: tone === 'skipped' ? 'var(--muted)' : `var(--status-${tone}-bg)` };
};
