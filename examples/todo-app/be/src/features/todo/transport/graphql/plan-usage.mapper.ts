import type { PlanUsageResult } from "../../application/plan-usage.contracts"
import type { PlanUsageType } from "./dto/plan-usage.type"

/** Maps the plan usage to the GraphQL type. */
export const toPlanUsageType = (usage: PlanUsageResult): PlanUsageType => ({
    plan: usage.plan,
    cap: usage.cap,
    activeCount: usage.activeCount,
})
