import { toPlaceOrderRequest, toPlaceOrderType } from "./place-order.mapper"

describe("place-order mapper", () => {
    it("trims the replay key and treats a blank or absent key as none", () => {
        expect(toPlaceOrderRequest({ idempotencyKey: "  k-1 " })).toEqual({ idempotencyKey: "k-1" })
        expect(toPlaceOrderRequest({ idempotencyKey: "   " }).idempotencyKey).toBeUndefined()
        expect(toPlaceOrderRequest({}).idempotencyKey).toBeUndefined()
    })

    it("maps the confirmed order to the type", () => {
        const order = {
            orderId: "o-1",
            status: "confirmed" as const,
            totalMinorUnits: 100,
            currency: "USD" as const,
            paymentId: "pay-1",
            replayed: false,
        }
        expect(toPlaceOrderType(order)).toEqual(order)
    })
})
