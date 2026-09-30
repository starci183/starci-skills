import { isRecord } from "@ecommerce/api"
import type { OrderConfirmation } from "../types"

/**
 * The confirmation of a `placeOrder` payload - as the order service answers it and as the shop's own
 * `/api/orders` door forwards it - or `null` when the payload is not that shape.
 */
export const toOrderConfirmation = (data: unknown): OrderConfirmation | null =>
    isRecord(data) &&
    typeof data.orderId === "string" &&
    typeof data.status === "string" &&
    typeof data.totalMinorUnits === "number" &&
    typeof data.currency === "string" &&
    typeof data.paymentId === "string" &&
    typeof data.replayed === "boolean"
        ? {
              orderId: data.orderId,
              status: data.status,
              totalMinorUnits: data.totalMinorUnits,
              currency: data.currency,
              paymentId: data.paymentId,
              replayed: data.replayed,
          }
        : null
