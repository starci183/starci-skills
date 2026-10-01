import type { DowngradePlanResult } from "../../application/downgrade-plan.contracts"
import type { DowngradePlanType } from "./dto/downgrade-plan.type"

/** Maps the downgraded subscription to the GraphQL type. */
export const toDowngradePlanType = (result: DowngradePlanResult): DowngradePlanType => ({
    subscriptionId: result.subscriptionId,
    plan: result.plan,
    status: result.status,
})
