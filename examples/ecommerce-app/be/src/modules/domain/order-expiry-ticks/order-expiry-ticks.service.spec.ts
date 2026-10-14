import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { ORDER_EXPIRY_QUEUE, OrderExpiryQueue, orderExpirySchedulerOf } from "@modules/queues/order-expiry"
import { ORDER_EXPIRY_TICKS_OPTIONS } from "./order-expiry-ticks.decorators"
import { OrderExpiryTicksService } from "./order-expiry-ticks.service"

const PAYMENT_WINDOW_MS = 30_000

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const outbox = recordingQueueOutbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderExpiryTicksService,
            OrderExpiryQueue,
            { provide: ORDER_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ORDER_EXPIRY_TICKS_OPTIONS, useValue: { olderThanMs: PAYMENT_WINDOW_MS } },
        ],
    }).compile()
    return { ticks: moduleRef.get(OrderExpiryTicksService), tx, outbox }
}

describe("OrderExpiryTicksService", () => {
    describe("enqueueTick", () => {
        it("commits the scheduler's typed payload to the same queue in an order transaction", async () => {
            const { ticks, tx, outbox } = await build()
            const scheduler = orderExpirySchedulerOf({ everyMs: 60_000, olderThanMs: PAYMENT_WINDOW_MS })

            await ticks.enqueueTick()

            expect(outbox.jobs).toEqual([{ queue: ORDER_EXPIRY_QUEUE, payload: scheduler.payload }])
            expect(outbox.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("rolls back a failed outbox write and propagates its failure", async () => {
            const { ticks, tx, outbox } = await build()
            const failure = new Error("outbox write failed")
            outbox.failNext("write", failure)

            await expect(ticks.enqueueTick()).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(outbox.jobs).toEqual([])
        })
    })
})
