import type { AgentFamily, AgentRef } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C6';

/** Slice B replaces this with the real marks. Maps pool/model/agent strings to an agent family. */
export function agentOf(input: { agent?: string | null; pool?: string | null; model?: string | null }): AgentRef {
  const text = `${input.agent ?? ''} ${input.pool ?? ''} ${input.model ?? ''}`.toLowerCase();
  const family: AgentFamily = /claude|anthropic|opus|sonnet|haiku|fable/.test(text) ? 'claude' : /codex|gpt|openai/.test(text) ? 'codex'
    : /devin|swe-/.test(text) ? 'devin' : /qwen/.test(text) ? 'qwen' : /gemini/.test(text) ? 'gemini' : 'unknown';
  return { family, pool: input.pool ?? null, model: input.model ?? null, label: input.model ?? input.pool ?? input.agent ?? 'chưa rõ' };
}

export function AgentAvatar({ agent, size = 20, withLabel = false }: { agent: AgentRef; size?: number; withLabel?: boolean }) {
  return <span className="inline-flex items-center gap-1.5" title={agent.label}><span className="inline-grid place-items-center rounded-full border bg-muted font-mono text-[10px] font-bold" style={{ width: size, height: size }}>{agent.family[0].toUpperCase()}</span>{withLabel ? <span className="text-xs">{agent.label}</span> : null}</span>;
}

/** Several agents (one per attempt/unit), overlapping, with "+N". */
export function AgentStack({ agents, max = 4, size = 20 }: { agents: AgentRef[]; max?: number; size?: number }) {
  return <span className="inline-flex -space-x-1.5">{agents.slice(0, max).map((a, i) => <AgentAvatar key={i} agent={a} size={size} />)}{agents.length > max ? <span className="pl-2 text-xs text-muted-foreground">+{agents.length - max}</span> : null}</span>;
}
