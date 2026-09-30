import type { GetBuyerStatusResult } from "../../application/get-buyer-status.contracts"
import type { BuyerStatusType } from "./dto/buyer-status.type"

/** Maps the buyer status to the GraphQL type. */
export const toBuyerStatusType = (status: GetBuyerStatusResult): BuyerStatusType => ({
    personId: status.personId,
    hasOrders: status.hasOrders,
})
