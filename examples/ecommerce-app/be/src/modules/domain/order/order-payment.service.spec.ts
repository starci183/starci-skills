import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OrderExpiredEvent, OrderPaidEvent } from "@modules/events/order"
import { ReceiptQueue } from "@modules/queues/receipt"
import { CLOCK } from "@modules/platform/clock"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OrderLogEvent } from "./order.log-events"
import { OrderPaymentService } from "./order-payment.service"
import { EXPIRE_PENDING_ORDERS_PLACED_BEFORE, MARK_ORDER_PAID_IF_PENDING } from "./persistence/order-lifecycle.sql"

const AT = "2026-02-03T04:05:06.000Z"

const build = async (entityManager: MockEntityManager, claimed = true) => {
    const inbox = mock<Inbox>()
    inbox.claim.mockResolvedValue(claimed)
    const bus = recordingEventBus()
    const logger = mock<Logger>()
    const receipts = mock<ReceiptQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderPaymentService,
            { provide: ORDER_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: INBOX, useValue: inbox },
            { provide: EVENT_BUS, useValue: bus },
            { provide: LOGGER, useValue: logger },
            { provide: ReceiptQueue, useValue: receipts },
        ],
    }).compile()
    return { service: moduleRef.get(OrderPaymentService), inbox, bus, logger, receipts }
}

describe("OrderPaymentService", () => {
    describe("recordPayment", () => {
        it("claims the event first, then moves the pending order to paid, publishes order.paid and enqueues the receipt in one committed transaction", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [MARK_ORDER_PAID_IF_PENDING, [{ person_id: "p-1", total_minor_units: 1250 }]],
                }),
            )
            const { service, inbox, bus, receipts } = await build(tx.em)

            await service.recordPayment({ eventId: "o-1", orderId: "o-1" })

            expect(inbox.claim).toHaveBeenCalledWith("billing-payment-confirmed", "o-1")
            expect(receipts.enqueueSendReceipt).toHaveBeenCalledWith({ orderId: "o-1" }, expect.anything())
            expect(tx.em.query).toHaveBeenCalledWith(MARK_ORDER_PAID_IF_PENDING, ["o-1", new Date(AT)])
            expect(bus.writes).toEqual([
                OrderPaidEvent.create({ orderId: "o-1", personId: "p-1", totalMinorUnits: 1250, paidAt: AT }),
            ])
            expect(bus.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("does nothing for a delivery whose event was already claimed", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { service, bus } = await build(tx.em, false)

            await service.recordPayment({ eventId: "o-1", orderId: "o-1" })

            expect(tx.em.transaction).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
        })

        it("logs and leaves the order alone when it is not pending any more", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [MARK_ORDER_PAID_IF_PENDING, []] }))
            const { service, bus, logger, receipts } = await build(tx.em)

            await service.recordPayment({ eventId: "o-1", orderId: "o-1" })

            expect(logger.warn).toHaveBeenCalledWith(OrderLogEvent.PaymentForClosedOrder, { orderId: "o-1" })
            expect(bus.writes).toEqual([])
            expect(receipts.enqueueSendReceipt).not.toHaveBeenCalled()
        })

        it("gives the claim back and rethrows when the transaction fails, so the redelivery is processed again", async () => {
            const failure = new Error("order database down")
            const tx = fakeTransaction(mockEntityManager({ query: [MARK_ORDER_PAID_IF_PENDING, []] }))
            tx.em.query.mockRejectedValueOnce(failure)
            const { service, inbox } = await build(tx.em)

            await expect(service.recordPayment({ eventId: "o-1", orderId: "o-1" })).rejects.toBe(failure)

            expect(inbox.release).toHaveBeenCalledWith("billing-payment-confirmed", "o-1")
        })
    })

    describe("expireOverdue", () => {
        it("expires the overdue pending orders and publishes order.expired for each in the same transaction", async () => {
            const cutoff = new Date("2026-02-03T03:05:06.000Z")
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        EXPIRE_PENDING_ORDERS_PLACED_BEFORE,
                        [
                            { id: "o-1", person_id: "p-1" },
                            { id: "o-2", person_id: "p-2" },
                        ],
                    ],
                }),
            )
            const { service, bus } = await build(tx.em)

            const result = await service.expireOverdue({ olderThanMs: 3_600_000, limit: 100 })

            expect(result).toEqual({ expired: 2 })
            expect(tx.em.query).toHaveBeenCalledWith(EXPIRE_PENDING_ORDERS_PLACED_BEFORE, [cutoff, 100])
            expect(bus.writes).toEqual([
                OrderExpiredEvent.create({ orderId: "o-1", personId: "p-1", expiredAt: AT }),
                OrderExpiredEvent.create({ orderId: "o-2", personId: "p-2", expiredAt: AT }),
            ])
            expect(bus.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("publishes nothing when no order is overdue", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [EXPIRE_PENDING_ORDERS_PLACED_BEFORE, []] }))
            const { service, bus } = await build(tx.em)

            expect(await service.expireOverdue({ olderThanMs: 3_600_000, limit: 100 })).toEqual({ expired: 0 })
            expect(bus.writes).toEqual([])
        })
    })
})
