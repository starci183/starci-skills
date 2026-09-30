import type { BuyerStatus } from "@modules/domain/order"

/** Reading the buyer status takes no input: it is the caller own status. */
export type GetBuyerStatusRequest = Readonly<Record<string, never>>

/** Whether the caller has confirmed orders; a person without orders is not an error, it is the honest answer. */
export type GetBuyerStatusResult = BuyerStatus
