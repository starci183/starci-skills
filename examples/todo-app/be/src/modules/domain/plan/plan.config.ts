import type { EnvSource } from "@modules/platform/config"
import type { PlanOptions } from "./plan.options"

/** Reads the plan options: the price and the currency of the paid plan are tunables with literal defaults. */
export const parsePlanConfig = (env: EnvSource): PlanOptions => ({
    paidPriceMinorUnits: env.int("PLAN_PAID_PRICE_MINOR_UNITS", 99000),
    paidCurrency: env.optional("PLAN_PAID_CURRENCY") ?? "VND",
})
