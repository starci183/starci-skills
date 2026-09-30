import { PaymentEntity } from "@modules/domain/payment"

/** A captured payment row with valid defaults and a fixed capture time; the spec overrides only what matters. */
export const paymentEntity = (overrides: Partial<PaymentEntity> = {}): PaymentEntity =>
    Object.assign(
        new PaymentEntity(),
        {
            id: "pay-1",
            personId: "p-1",
            orderId: "o-1",
            amountMinorUnits: 1500,
            status: "captured",
            createdAt: new Date("2026-02-03T04:05:06.000Z"),
        },
        overrides,
    )
