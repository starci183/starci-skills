import type { AgentFamily, AgentRef } from '../../contract';
import type { Concept } from '../concept';
import { AgentMark, familyTint, tintStyle } from './agent-marks';

export const concept: Concept = 'C6';

/** Maps agent/pool/model strings to an agent family (pool `devin-agent`, model `swe-2-max`, `gpt-6-sol`, `claude-opus-5-5`…). */
export function agentOf(input: { agent?: string | null; pool?: string | null; model?: string | null }): AgentRef {
  const text = `${input.agent ?? ''} ${input.pool ?? ''} ${input.model ?? ''}`.toLowerCase();
  const family: AgentFamily = /claude|anthropic|opus|sonnet|haiku|fable/.test(text) ? 'claude' : /codex|gpt|openai/.test(text) ? 'codex'
    : /devin|swe-|cognition/.test(text) ? 'devin' : /qwen/.test(text) ? 'qwen' : /gemini|gemma/.test(text) ? 'gemini' : 'unknown';
  return { family, pool: input.pool ?? null, model: input.model ?? null, label: input.model ?? input.pool ?? input.agent ?? 'chưa rõ' };
}

export type LinkedAgent = AgentRef & { href?: string; live?: boolean };

const tooltip = (agent: AgentRef) => [familyTint[agent.family].name, agent.pool, agent.model].filter(Boolean).join(' · ');

/** Round family mark on a tinted circle. `live` adds a pulsing ring; `href` makes it a link. Tooltip: agent · pool · model. */
export function AgentAvatar({ agent, size = 20, withLabel = false, live = false, href }: { agent: LinkedAgent; size?: number; withLabel?: boolean; live?: boolean; href?: string }) {
  const tint = familyTint[agent.family];
  const target = href ?? agent.href;
  const isLive = live || agent.live;
  const circle = <span className="relative inline-grid shrink-0 place-items-center rounded-full border" style={{ width: size, height: size, padding: agent.family === 'devin' ? 0 : Math.max(2, Math.round(size * 0.2)), ...tintStyle(tint.tone) }} data-agent={agent.family}>
    {isLive ? <span className="pointer-events-none absolute -inset-0.5 animate-ping rounded-full border-2 opacity-60 motion-reduce:animate-none" style={{ borderColor: 'var(--status-running)' }} aria-hidden="true" /> : null}
    <AgentMark family={agent.family} initial={(agent.label[0] ?? '?').toUpperCase()} />
  </span>;
  const inner = <>{circle}{withLabel ? <span className="min-w-0 truncate text-xs">{agent.label}</span> : null}</>;
  const cls = 'inline-flex min-w-0 items-center gap-1.5';
  return target ? <a href={target} className={`${cls} hover:opacity-80`} title={tooltip(agent)} aria-label={tooltip(agent)}>{inner}</a>
    : <span className={cls} title={tooltip(agent)}>{inner}</span>;
}

/** Several agents (one per attempt/unit), overlapping, with "+N". */
export function AgentStack({ agents, max = 4, size = 20 }: { agents: LinkedAgent[]; max?: number; size?: number }) {
  return <span className="inline-flex items-center"><span className="inline-flex -space-x-1.5">{agents.slice(0, max).map((a, i) => <span key={i} className="rounded-full ring-2 ring-card"><AgentAvatar agent={a} size={size} /></span>)}</span>{agents.length > max ? <span className="pl-2 text-xs text-muted-foreground">+{agents.length - max}</span> : null}</span>;
}
