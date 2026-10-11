import type { AgentFamily, AgentRef } from '../../contract';
import { Avatar, Link } from '@heroui/react';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';
import { familyTint, tintStyle } from './agent-marks';
import devinPng from './logos/devin.png';

export const concept: Concept = 'C6';

const PROVIDER_FAMILY: Record<string, AgentFamily> = { claude: 'claude', anthropic: 'claude', codex: 'codex', openai: 'codex', devin: 'devin', cognition: 'devin' };
const ORIGINAL_MARKS: Partial<Record<AgentFamily, string>> = { claude: '/logos/claude.png', codex: '/logos/codex.png', devin: devinPng };

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

/** Vendor avatar retains the original family marks and recorded identity; live state adds a static ring. */
export function AgentAvatar({ agent, size = 20, withLabel = false, live = false, href }: Readonly<{ agent: LinkedAgent; size?: number; withLabel?: boolean; live?: boolean; href?: string }>) {
  const tint = familyTint[agent.family];
  const target = href ?? agent.href;
  const isLive = live || agent.live;
  const mark = ORIGINAL_MARKS[agent.family];
  const circle = <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
    {isLive ? <span className="pointer-events-none absolute -inset-0.5 rounded-full border-2 opacity-60" style={{ borderColor: 'var(--status-running)' }} aria-hidden="true" /> : null}
    <Avatar className="shrink-0 rounded-full" style={{ width: size, height: size, ...tintStyle(tint.tone), background: agent.family === 'unknown' ? 'var(--default)' : 'var(--card)' }} data-agent={agent.family}>
      {mark ? <Avatar.Image src={mark} alt="" aria-hidden="true" className={`size-full ${agent.family === 'claude' ? 'object-contain p-[15%]' : 'object-cover'}`} draggable={false} /> : null}
      <Avatar.Fallback className="size-full bg-transparent p-0 text-xs" aria-hidden="true">{(agent.label[0] ?? '?').toUpperCase()}</Avatar.Fallback>
    </Avatar>
  </span>;
  const inner = <>{circle}{withLabel ? <span className="min-w-0 truncate text-xs">{agent.label}</span> : null}</>;
  const cls = 'inline-flex min-w-0 items-center gap-2';
  return target ? <span title={tooltip(agent)} className="inline-flex min-w-0"><Link href={target} className={`${cls} text-foreground`} aria-label={tooltip(agent)}>{inner}</Link></span>
    : <span className={cls} title={tooltip(agent)}>{inner}</span>;
}

/** Several agents (one per attempt/unit), overlapping, with "+N". */
export function AgentStack({ agents, max = 4, size = 20 }: Readonly<{ agents: LinkedAgent[]; max?: number; size?: number }>) {
  return <span className="inline-flex items-center"><span className="inline-flex -space-x-2">{agents.slice(0, max).map((a, i) => ({ key: `${a.family}:${a.label}:${i}`, agent: a })).map(item => <span key={item.key} className="rounded-full ring-2 ring-card"><AgentAvatar agent={item.agent} size={size} /></span>)}</span>{agents.length > max ? <span className="pl-2 text-xs text-muted-foreground">+{agents.length - max}</span> : null}</span>;
}
