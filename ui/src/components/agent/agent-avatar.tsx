import type { AgentFamily, AgentRef } from '../../contract';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';
import { AgentMark, familyTint, tintStyle } from './agent-marks';

export const concept: Concept = 'C6';

const PROVIDER_FAMILY: Record<string, AgentFamily> = { claude: 'claude', anthropic: 'claude', codex: 'codex', openai: 'codex', devin: 'devin', cognition: 'devin' };

type ModelObservation = { requestedModel?: string | null; attestedAt?: number | null; modelAuthority?: 'attested' | 'unobserved' };
export type LinkedAgent = AgentRef & ModelObservation & { href?: string; live?: boolean };

/** Maps agent/provider/pool/model fields to an agent family. The declared `provider` (the registry.yaml
 * provider family the attempt row carries) wins; the agent/pool/model strings are the fallback
 * (pool `devin-agent`, model `swe-2-max`, `gpt-6.1-sol`, `claude-opus-5-5`…). */
export function agentOf(input: { agent?: string | null; provider?: string | null; pool?: string | null; model?: string | null } & ModelObservation): LinkedAgent {
  const family: AgentFamily = PROVIDER_FAMILY[(input.provider ?? '').toLowerCase()]
    ?? PROVIDER_FAMILY[(input.agent ?? '').toLowerCase()]
    ?? (() => { const text = `${input.pool ?? ''} ${input.model ?? ''}`.toLowerCase();
      return /claude|anthropic|opus|sonnet|haiku|fable/.test(text) ? 'claude' : /codex|gpt|openai/.test(text) ? 'codex'
        : /devin|swe-|cognition/.test(text) ? 'devin' : 'unknown'; })();
  return { family, pool: input.pool ?? null, model: input.model ?? null, label: input.model ?? input.pool ?? input.agent ?? input.provider ?? t('unknown'),
    requestedModel: input.requestedModel, attestedAt: input.attestedAt, modelAuthority: input.modelAuthority };
}

const tooltip = (agent: LinkedAgent) => [familyTint[agent.family].name, agent.pool,
  agent.requestedModel ? t('Requested model: {model}', { model: agent.requestedModel }) : null,
  agent.model ? t(agent.modelAuthority === 'attested' ? 'Attested model: {model}' : 'Recorded model: {model}', { model: agent.model }) : null,
  agent.modelAuthority !== 'attested' ? t('Model attestation has not been observed.') : null].filter(Boolean).join(' · ');

/** Round family mark on a tinted circle. `live` adds a pulsing ring; `href` makes it a link. Tooltip: agent · pool · model. */
export function AgentAvatar({ agent, size = 20, withLabel = false, live = false, href }: { agent: LinkedAgent; size?: number; withLabel?: boolean; live?: boolean; href?: string }) {
  const tint = familyTint[agent.family];
  const target = href ?? agent.href;
  const isLive = live || agent.live;
  const circle = <span className="relative inline-grid shrink-0 place-items-center rounded-full border" style={{ width: size, height: size, padding: agent.family === 'devin' ? 0 : Math.max(2, Math.round(size * 0.2)), ...tintStyle(tint.tone) }} data-agent={agent.family}>
    {isLive ? <span className="pointer-events-none absolute -inset-0.5 rounded-full border-2 opacity-60" style={{ borderColor: 'var(--status-running)' }} aria-hidden="true" /> : null}
    <AgentMark family={agent.family} initial={(agent.label[0] ?? '?').toUpperCase()} />
  </span>;
  const inner = <>{circle}{withLabel ? <span className="min-w-0 truncate text-xs">{agent.label}</span> : null}</>;
  const cls = 'inline-flex min-w-0 items-center gap-2';
  return target ? <a href={target} className={`${cls} hover:opacity-80`} title={tooltip(agent)} aria-label={tooltip(agent)}>{inner}</a>
    : <span className={cls} title={tooltip(agent)}>{inner}</span>;
}

/** Several agents (one per attempt/unit), overlapping, with "+N". */
export function AgentStack({ agents, max = 4, size = 20 }: Readonly<{ agents: LinkedAgent[]; max?: number; size?: number }>) {
  return <span className="inline-flex items-center"><span className="inline-flex -space-x-2">{agents.slice(0, max).map((a, i) => <span key={`${a.family}:${a.label}:${i}`} className="rounded-full ring-2 ring-card"><AgentAvatar agent={a} size={size} /></span>)}</span>{agents.length > max ? <span className="pl-2 text-xs text-muted-foreground">+{agents.length - max}</span> : null}</span>;
}
