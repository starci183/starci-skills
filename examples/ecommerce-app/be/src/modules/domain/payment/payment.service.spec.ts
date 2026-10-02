import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { Test } from "@nestjs/testing"
import { paymentRow } from "@tests/fixtures/builders/payment.builder"
import { PaymentService } from "./payment.service"
import { PaymentEntity } from "./persistence/entities/payment.entity"

const build = async (entityManager: MockEntityManager, clock: FakeClock) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentService,
            { provide: ORDER_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return moduleRef.get(PaymentService)
}

describe("PaymentService", () => {
    describe("capture", () => {
        it("records a captured payment stamped with the clock through the caller transaction manager", async () => {
            const clock = new FakeClock("2026-02-03T04:05:06.000Z")
            const manager = mockEntityManager({ save: [PaymentEntity, paymentRow()] })

            const view = await (
                await build(mockEntityManager(), clock)
            ).capture({
                manager,
                personId: "p-1",
                orderId: "o-1",
                amountMinorUnits: 1500,
            })

            expect(view).toEqual({ paymentId: "pay-1", amountMinorUnits: 1500 })
            expect(manager.save).toHaveBeenCalledWith(PaymentEntity, {
                personId: "p-1",
                orderId: "o-1",
                amountMinorUnits: 1500,
                status: "captured",
                createdAt: new Date("2026-02-03T04:05:06.000Z"),
            })
        })

        it("stamps the moment the clock shows when the payment is captured", async () => {
            const clock = new FakeClock("2026-02-03T04:05:06.000Z")
            const manager = mockEntityManager({
                save: [PaymentEntity, paymentRow({ id: "pay-2", orderId: "o-2", amountMinorUnits: 100 })],
            })
            const service = await build(mockEntityManager(), clock)
            clock.advance(60_000)

            await service.capture({ manager, personId: "p-1", orderId: "o-2", amountMinorUnits: 100 })

            expect(manager.save).toHaveBeenCalledWith(
                PaymentEntity,
                expect.objectContaining({ createdAt: new Date("2026-02-03T04:06:06.000Z") }),
            )
        })
    })

    describe("refund", () => {
        it("marks the captured payment of the order as refunded through the caller transaction manager", async () => {
            const manager = mockEntityManager({ update: [PaymentEntity, { affected: 1 }] })

            const refunded = await (
                await build(mockEntityManager(), new FakeClock("2026-02-03T04:05:06.000Z"))
            ).refund({ manager, orderId: "o-1" })

            expect(refunded).toBe(true)
            expect(manager.update).toHaveBeenCalledWith(
                PaymentEntity,
                { orderId: "o-1", status: "captured" },
                { status: "refunded" },
            )
        })

        it("answers false when no captured payment remained or the driver reports no affected count", async () => {
            const service = await build(mockEntityManager(), new FakeClock("2026-02-03T04:05:06.000Z"))

            expect(
                await service.refund({
                    manager: mockEntityManager({ update: [PaymentEntity, { affected: 0 }] }),
                    orderId: "o-1",
                }),
            ).toBe(false)
            expect(
                await service.refund({ manager: mockEntityManager({ update: [PaymentEntity, {}] }), orderId: "o-1" }),
            ).toBe(false)
        })
    })

    describe("findByOrder", () => {
        it("returns the payment of the order read with the caller manager when one is given", async () => {
            const own = mockEntityManager()
            const manager = mockEntityManager({ findOneBy: [PaymentEntity, paymentRow()] })

            const view = await (
                await build(own, new FakeClock("2026-02-03T04:05:06.000Z"))
            ).findByOrder({ orderId: "o-1", manager })

            expect(view).toEqual({ paymentId: "pay-1", amountMinorUnits: 1500 })
            expect(manager.findOneBy).toHaveBeenCalledWith(PaymentEntity, { orderId: "o-1" })
        })

        it("reads with its own manager when no manager is given", async () => {
            const own = mockEntityManager({ findOneBy: [PaymentEntity, paymentRow()] })

            expect(
                await (await build(own, new FakeClock("2026-02-03T04:05:06.000Z"))).findByOrder({ orderId: "o-1" }),
            ).toEqual({
                paymentId: "pay-1",
                amountMinorUnits: 1500,
            })
        })

        it("returns null when no payment was captured for the order", async () => {
            const own = mockEntityManager({ findOneBy: [PaymentEntity, null] })

            expect(
                await (await build(own, new FakeClock("2026-02-03T04:05:06.000Z"))).findByOrder({ orderId: "o-9" }),
            ).toBeNull()
        })
    })
})
