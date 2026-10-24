import type { Outcome, Page } from "@modules/platform/primitives"
import type { OrderErrorCode } from "./errors/order.error"
import type { OrderStatus } from "./order-status.contracts"

/** What a client asks of the list of orders: a page size and where to continue from. */
export interface ListOrdersAsk {
    /** The page size, 1 up to the biggest page a client may ask for. */
    readonly first: number
    /** The cursor of the last item of the page before, as that page answered it; absent or null for the first page. */
    readonly after?: string | null
}

/** What listing the orders of a person takes. */
export interface ListOrdersParams extends ListOrdersAsk {
    /** The buyer whose orders are listed. */
    readonly personId: string
}

/** One order as the list shows it. */
export interface OrderSummary {
    /** The order id. */
    readonly orderId: string
    /** The lifecycle state. */
    readonly status: OrderStatus
    /** The order total in minor units. */
    readonly totalMinorUnits: number
    /** The currency. */
    readonly currency: string
    /** When the order was placed, as the database wrote it. */
    readonly placedAt: string
}

/** A page of the orders of a person, newest first. */
export type OrderPage = Page<OrderSummary>

/** The page, or why there is none: a page size out of bounds, or a cursor this service did not sign. */
export type ListOrdersResult = Outcome<OrderPage, OrderErrorCode.PageSizeInvalid | OrderErrorCode.PageCursorInvalid>
