import type { PlacedOrder } from "@modules/domain/order"
import type { PlaceOrderRequest } from "../../application/place-order.contracts"
import type { PlaceOrderInput } from "./dto/place-order.input"
import type { PlaceOrderType } from "./dto/place-order.type"

/** Maps the GraphQL input to the command request; the order service decides what a blank key means. */
export const toPlaceOrderRequest = (input: PlaceOrderInput): PlaceOrderRequest => ({
    idempotencyKey: input.idempotencyKey,
})

/** Maps the confirmed order to the GraphQL type. */
export const toPlaceOrderType = (order: PlacedOrder): PlaceOrderType => ({
    orderId: order.orderId,
    status: order.status,
    totalMinorUnits: order.totalMinorUnits,
    currency: order.currency,
    replayed: order.replayed,
})
