import type { CSSProperties } from 'react';
import type { AgentFamily } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C6';

/** Simple inline marks (24x24, currentColor). Recognisable shapes, no external images. */
export function AgentMark({ family, initial = '?' }: { family: AgentFamily; initial?: string }) {
  const props = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, className: 'size-full' };
  switch (family) {
    case 'claude': // Anthropic-style spark: starburst of rounded rays
      return <svg {...props} strokeWidth="2.6"><path d="M12 2.8v6.1M12 15.1v6.1M2.8 12h6.1M15.1 12h6.1M5.5 5.5l4.3 4.3M14.2 14.2l4.3 4.3M18.5 5.5l-4.3 4.3M9.8 14.2l-4.3 4.3" /></svg>;
    case 'codex': // OpenAI-style knot: three interlaced rounded bars
      return <svg {...props} strokeWidth="1.8"><rect x="7.2" y="2.6" width="9.6" height="12" rx="4.8" /><rect x="7.2" y="2.6" width="9.6" height="12" rx="4.8" transform="rotate(60 12 12)" /><rect x="7.2" y="2.6" width="9.6" height="12" rx="4.8" transform="rotate(120 12 12)" /></svg>;
    case 'devin': // Cognition-style bold D
      return <svg {...props} strokeWidth="2.8"><path d="M7 4.5h4.5a7.5 7.5 0 0 1 0 15H7z" /><path d="M7 9.5h3.2M7 14.5h3.2" strokeWidth="2" opacity="0.7" /></svg>;
    case 'qwen': // Q with tail
      return <svg {...props} strokeWidth="2.6"><circle cx="11.5" cy="11.5" r="6.8" /><path d="M13.4 13.6l6.2 6.2" /></svg>;
    case 'gemini': // four-point concave star
      return <svg {...props} strokeWidth="1.6" fill="currentColor"><path d="M12 2.5c.7 5.6 3.9 8.8 9.5 9.5-5.6.7-8.8 3.9-9.5 9.5-.7-5.6-3.9-8.8-9.5-9.5 5.6-.7 8.8-3.9 9.5-9.5z" /></svg>;
    default:
      return <svg {...props} strokeWidth="0"><text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" fontFamily="var(--font-mono, monospace)">{initial}</text></svg>;
  }
}

/** Tint per family, using existing tokens only. */
export const familyTint: Record<AgentFamily, { name: string; tone: string }> = {
  claude: { name: 'Claude', tone: 'warning' },
  codex: { name: 'Codex', tone: 'queued' },
  devin: { name: 'Devin', tone: 'running' },
  qwen: { name: 'Qwen', tone: 'primary' },
  gemini: { name: 'Gemini', tone: 'success' },
  unknown: { name: 'Chưa rõ', tone: 'skipped' },
};
export const tintStyle = (tone: string): CSSProperties => tone === 'primary'
  ? { color: 'var(--primary)', borderColor: 'color-mix(in oklab, var(--primary) 40%, transparent)', background: 'color-mix(in oklab, var(--primary) 12%, transparent)' }
  : { color: `var(--status-${tone})`, borderColor: `var(--status-${tone}-line)`, background: tone === 'skipped' ? 'var(--muted)' : `var(--status-${tone}-bg)` };
