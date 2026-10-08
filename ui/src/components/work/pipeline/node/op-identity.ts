import type { AgentRef, LegRow, LegRowV3 } from '../../../../contract';
import type { Concept } from '../../../concept';
export const concept: Concept = 'C7';
import { agentOf } from '../../../agent/agent-avatar';

const infoOf = (leg: LegRow) => (leg as LegRowV3).info ?? null;

/** Human operation label from the current catalog; the exact leg id remains the fallback. */
export const legName = (leg: LegRow) => infoOf(leg)?.nameVi?.trim() || infoOf(leg)?.nameEn?.trim() || leg.op;
/** One-line goal: Vietnamese, else English, else null. */
export const legGoal = (leg: LegRow) => infoOf(leg)?.goal.vi ?? infoOf(leg)?.goal.en ?? null;
export const legInfo = infoOf;

/** Distinct recorded attempt agents in first-use order; unbound planned legs have no assignment marks. */
export function legAgents(leg: LegRow): AgentRef[] {
  if (leg.inPlan && leg.binding === 'unbound') return [];
  const seen = new Map<string, AgentRef>();
  for (const attempt of leg.attempts) {
    if (!attempt.agent && !attempt.pool && !attempt.model) continue;
    const ref = agentOf({ agent: attempt.agent, pool: attempt.pool, model: attempt.model });
    const key = `${ref.family}|${ref.pool ?? ''}|${ref.model ?? ''}`;
    if (!seen.has(key)) seen.set(key, ref);
  }
  return [...seen.values()];
}
