import type { AgentRef, LegRow, LegRowV3 } from '../../../../contract';
import type { Concept } from '../../../concept';
export const concept: Concept = 'C7';
import { agentOf } from '../../../agent/agent-avatar';

const infoOf = (leg: LegRow) => (leg as LegRowV3).info ?? null;

/** Vietnamese name of a leg (falls back to the op id). */
export const legName = (leg: LegRow) => infoOf(leg)?.nameVi ?? leg.op;
/** One-line goal: Vietnamese, else English, else null. */
export const legGoal = (leg: LegRow) => infoOf(leg)?.goal.vi ?? infoOf(leg)?.goal.en ?? null;
export const legInfo = infoOf;

/** One agent per distinct agent/pool/model that ran an attempt on this leg, in first-use order. */
export function legAgents(leg: LegRow): AgentRef[] {
  const seen = new Map<string, AgentRef>();
  for (const attempt of leg.attempts) {
    if (!attempt.agent && !attempt.pool && !attempt.model) continue;
    const ref = agentOf({ agent: attempt.agent, pool: attempt.pool, model: attempt.model });
    const key = `${ref.family}|${ref.pool ?? ''}|${ref.model ?? ''}`;
    if (!seen.has(key)) seen.set(key, ref);
  }
  return [...seen.values()];
}
