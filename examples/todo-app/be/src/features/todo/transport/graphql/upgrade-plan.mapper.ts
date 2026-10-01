import type { UpgradePlanResult } from "../../application/upgrade-plan.contracts"
import type { UpgradePlanType } from "./dto/upgrade-plan.type"

/** Maps the opened checkout to the GraphQL type. */
export const toUpgradePlanType = (result: UpgradePlanResult): UpgradePlanType => ({
    subscriptionId: result.subscriptionId,
    paymentIntentId: result.paymentIntentId,
    checkoutUrl: result.checkoutUrl,
    status: result.status,
})
