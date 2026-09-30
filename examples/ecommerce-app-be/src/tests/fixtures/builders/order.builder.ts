import { OrderEntity } from "@modules/domain/order"
import type { PlacedOrder } from "@modules/domain/order"

/** A confirmed order row with valid defaults and a fixed creation time; the spec overrides only what matters. */
export const orderEntity = (overrides: Partial<OrderEntity> = {}): OrderEntity =>
    Object.assign(
        new OrderEntity(),
        {
            id: "o-1",
            personId: "p-1",
            status: "confirmed",
            totalMinorUnits: 1250,
            currency: "USD",
            idempotencyKey: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        overrides,
    )

/** The confirmed order the doors answer, with valid defaults. */
export const placedOrder = (overrides: Partial<PlacedOrder> = {}): PlacedOrder => ({
    orderId: "o-1",
    status: "confirmed",
    totalMinorUnits: 1250,
    currency: "USD",
    paymentId: "pay-1",
    replayed: false,
    ...overrides,
})
