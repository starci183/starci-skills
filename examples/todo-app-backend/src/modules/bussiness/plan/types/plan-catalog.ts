/**
 * data.plan.plan: a fixed offering, not a per-person configuration. The catalog holds exactly two rows;
 * taskCap is present and equal to 20 if and only if tier is free (the data record's own invariant).
 * Kept as an in-code constant rather than a table: nothing here is ever created, edited or listed by a
 * person, so there is nothing a database row would buy over a literal.
 */
export interface PlanDefinition {
  readonly id: string;
  readonly tier: 'free' | 'paid';
  /** 20 for free; absent (unlimited) for paid. */
  readonly taskCap?: number;
}

export const FREE_PLAN_TASK_CAP = 20;

export const FREE_PLAN: PlanDefinition = { id: 'free', tier: 'free', taskCap: FREE_PLAN_TASK_CAP };
export const PAID_PLAN: PlanDefinition = { id: 'paid', tier: 'paid' };

export const PLAN_CATALOG: readonly PlanDefinition[] = [FREE_PLAN, PAID_PLAN];

export const findPlanById = (id: string): PlanDefinition => PLAN_CATALOG.find(plan => plan.id === id) ?? FREE_PLAN;
