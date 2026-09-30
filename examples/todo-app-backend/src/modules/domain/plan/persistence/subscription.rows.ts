import type { SubscriptionView } from "../plan.contracts"
import type { SubscriptionEntity } from "./entities/subscription.entity"

/** Maps a subscription row to the view callers get. */
export const toSubscriptionView = (row: SubscriptionEntity): SubscriptionView => ({
    id: row.id,
    personId: row.personId,
    plan: row.plan,
    status: row.status,
    periodEnd: row.periodEnd,
    gatewayCustomerId: row.gatewayCustomerId,
})
