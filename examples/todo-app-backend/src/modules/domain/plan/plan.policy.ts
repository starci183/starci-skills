import type { PlanDefinition, SubscriptionStatus } from "./plan.contracts"

/** How many active tasks the free plan allows. */
export const FREE_PLAN_TASK_CAP = 20

/** The free plan of the catalog. */
export const FREE_PLAN: PlanDefinition = { id: "free", taskCap: FREE_PLAN_TASK_CAP }

/** The paid plan of the catalog: no cap. */
export const PAID_PLAN: PlanDefinition = { id: "paid", taskCap: null }

/**
 * The plan a subscription status reads as: active and past-due are paid; free, pending and lapsed read as free, so a
 * lapsed row reverts to free on read without ever being written.
 */
export const planOfStatus = (status: SubscriptionStatus): PlanDefinition =>
    status === "active" || status === "past-due" ? PAID_PLAN : FREE_PLAN
