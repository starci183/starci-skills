import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PAYMENT_SERVICE } from "@modules/domain/payment"
import type { PaymentService } from "@modules/domain/payment"
import { RECEIPT_STORAGE } from "@modules/integrations/receipt-storage"
import type { ReceiptStorage } from "@modules/integrations/receipt-storage"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { orderRow } from "@tests/fixtures/builders/order.builder"
import { OrderErrorCode } from "./errors/order.error"
import { OrderLogEvent } from "./order.log-events"
import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"
import { ReceiptService } from "./receipt.service"

const ORDER = orderRow({ id: "o-1", personId: "p-1", totalMinorUnits: 1250 })
const LINES = [
    { id: "l-1", orderId: "o-1", productId: "sku-1", quantity: 2, unitPriceMinorUnits: 500 },
    { id: "l-2", orderId: "o-1", productId: "sku-2", quantity: 1, unitPriceMinorUnits: 250 },
]
const KEY = "receipts/o-1.json"
const LINK = {
    url: "http://minio.test/receipts/receipts/o-1.json?X-Amz-Signature=s",
    expiresAt: new Date("2026-01-01T00:05:00.000Z"),
}
const DOCUMENT = {
    orderId: "o-1",
    personId: "p-1",
    lines: [
        { productId: "sku-1", quantity: 2, unitPriceMinorUnits: 500 },
        { productId: "sku-2", quantity: 1, unitPriceMinorUnits: 250 },
    ],
    totalMinorUnits: 1250,
    currency: "USD",
    paymentId: "pay-1",
    placedAt: "2026-01-01T00:00:00.000Z",
}

const build = async (entityManager: MockEntityManager) => {
    const storage = mock<ReceiptStorage>()
    const payments = mock<PaymentService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReceiptService,
            { provide: ORDER_ENTITY_MANAGER, useValue: entityManager },
            { provide: RECEIPT_STORAGE, useValue: storage },
            { provide: PAYMENT_SERVICE, useValue: payments },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { receipts: moduleRef.get(ReceiptService), storage, payments, logger }
}

describe("ReceiptService", () => {
    describe("archive", () => {
        it("stores the receipt document of the order and records its key", async () => {
            const em = mockEntityManager({
                findOneBy: [OrderEntity, ORDER],
                find: [OrderLineEntity, LINES],
                update: [OrderEntity, {}],
            })
            const { receipts, storage, payments } = await build(em)
            payments.findByOrder.mockResolvedValue({ paymentId: "pay-1", amountMinorUnits: 1250 })

            await expect(receipts.archive("o-1")).resolves.toBe(KEY)

            expect(storage.store).toHaveBeenCalledWith({ key: KEY, content: Buffer.from(JSON.stringify(DOCUMENT)) })
            expect(em.update).toHaveBeenCalledWith(OrderEntity, { id: "o-1" }, { receiptKey: KEY })
        })

        it("answers null for an order that does not exist", async () => {
            const { receipts, storage } = await build(mockEntityManager({ findOneBy: [OrderEntity, null] }))

            await expect(receipts.archive("o-9")).resolves.toBeNull()

            expect(storage.store).not.toHaveBeenCalled()
        })

        it("logs a storage failure, records no key and answers null", async () => {
            const em = mockEntityManager({ findOneBy: [OrderEntity, ORDER], find: [OrderLineEntity, LINES] })
            const { receipts, storage, payments, logger } = await build(em)
            const failure = new Error("storage unavailable")
            payments.findByOrder.mockResolvedValue({ paymentId: "pay-1", amountMinorUnits: 1250 })
            storage.store.mockRejectedValue(failure)

            await expect(receipts.archive("o-1")).resolves.toBeNull()

            expect(logger.error).toHaveBeenCalledWith(OrderLogEvent.ReceiptArchiveFailed, failure, { orderId: "o-1" })
            expect(em.update).not.toHaveBeenCalled()
        })

        it("logs an order without its payment as the payment-missing error and stores nothing", async () => {
            const em = mockEntityManager({ findOneBy: [OrderEntity, ORDER], find: [OrderLineEntity, LINES] })
            const { receipts, storage, payments, logger } = await build(em)
            payments.findByOrder.mockResolvedValue(null)

            await expect(receipts.archive("o-1")).resolves.toBeNull()

            expect(logger.error).toHaveBeenCalledWith(
                OrderLogEvent.ReceiptArchiveFailed,
                expect.objectContaining({ code: OrderErrorCode.PaymentMissing }),
                { orderId: "o-1" },
            )
            expect(storage.store).not.toHaveBeenCalled()
        })
    })

    describe("link", () => {
        it("answers the link of an archived receipt without storing it again", async () => {
            const em = mockEntityManager({ findOneBy: [OrderEntity, orderRow({ ...ORDER, receiptKey: KEY })] })
            const { receipts, storage } = await build(em)
            storage.linkOf.mockReturnValue(LINK)

            expect(await receipts.link({ personId: "p-1", orderId: "o-1" })).toSucceedWith(LINK)

            expect(em.findOneBy).toHaveBeenCalledWith(OrderEntity, { id: "o-1", personId: "p-1" })
            expect(storage.linkOf).toHaveBeenCalledWith(KEY)
            expect(storage.store).not.toHaveBeenCalled()
        })

        it("archives a receipt the order does not have yet, then answers its link", async () => {
            const { receipts, storage, payments } = await build(
                mockEntityManager({
                    findOneBy: [OrderEntity, ORDER],
                    find: [OrderLineEntity, LINES],
                    update: [OrderEntity, {}],
                }),
            )
            payments.findByOrder.mockResolvedValue({ paymentId: "pay-1", amountMinorUnits: 1250 })
            storage.linkOf.mockReturnValue(LINK)

            expect(await receipts.link({ personId: "p-1", orderId: "o-1" })).toSucceedWith(LINK)

            expect(storage.store).toHaveBeenCalledTimes(1)
            expect(storage.linkOf).toHaveBeenCalledWith(KEY)
        })

        it("refuses an order the buyer does not have", async () => {
            const { receipts } = await build(mockEntityManager({ findOneBy: [OrderEntity, null] }))

            expect(await receipts.link({ personId: "p-2", orderId: "o-1" })).toBeRefused({
                code: OrderErrorCode.ReceiptNotFound,
                params: { orderId: "o-1" },
            })
        })

        it("refuses as not ready when the receipt cannot be archived now", async () => {
            const em = mockEntityManager({ findOneBy: [OrderEntity, ORDER], find: [OrderLineEntity, LINES] })
            const { receipts, storage, payments } = await build(em)
            payments.findByOrder.mockResolvedValue({ paymentId: "pay-1", amountMinorUnits: 1250 })
            storage.store.mockRejectedValue(new Error("storage unavailable"))

            expect(await receipts.link({ personId: "p-1", orderId: "o-1" })).toBeRefused({
                code: OrderErrorCode.ReceiptNotReady,
                params: { orderId: "o-1" },
            })
            expect(storage.linkOf).not.toHaveBeenCalled()
        })
    })
})
