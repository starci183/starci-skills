import type { PaymentIntentEntity } from "./entities/payment-intent.entity"
import { toPaymentIntentView } from "./payment-intent.rows"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("payment intent rows mapper", () => {
    it("copies a payment intent row into the view", () => {
        const row: PaymentIntentEntity = {
            id: "i1",
            subscriptionId: "s1",
            gateway: "sepay",
            gatewayIntentId: "g1",
            amount: 100000,
            currency: "VND",
            status: "paid",
            appliedAt: AT,
        }
        expect(toPaymentIntentView(row)).toEqual(row)
    })

    it("keeps an unapplied intent applied-at null", () => {
        const row: PaymentIntentEntity = {
            id: "i2",
            subscriptionId: "s1",
            gateway: "sepay",
            gatewayIntentId: "g2",
            amount: 100000,
            currency: "VND",
            status: "pending",
            appliedAt: null,
        }
        expect(toPaymentIntentView(row).appliedAt).toBeNull()
    })
})
