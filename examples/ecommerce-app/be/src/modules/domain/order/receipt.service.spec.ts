import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { RECEIPT_STORAGE } from "@modules/integrations/receipt-storage"
import type { ReceiptStorage } from "@modules/integrations/receipt-storage"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { orderRow } from "@tests/fixtures/builders/order.builder"
import { OrderErrorCode } from "./errors/order.error"
import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"
import { ReceiptService } from "./receipt.service"

const ORDER = orderRow({ id: "o-1", personId: "p-1", status: "paid", totalMinorUnits: 1250 })
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
    placedAt: "2026-01-01T00:00:00.000Z",
}

const build = async (entityManager: MockEntityManager) => {
    const storage = mock<ReceiptStorage>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReceiptService,
            { provide: ORDER_ENTITY_MANAGER, useValue: entityManager },
            { provide: RECEIPT_STORAGE, useValue: storage },
        ],
    }).compile()
    return { receipts: moduleRef.get(ReceiptService), storage }
}

describe("ReceiptService", () => {
    describe("prepareReceipt", () => {
        it("builds the receipt document of a paid order under its stable key", async () => {
            const em = mockEntityManager({ findOneBy: [OrderEntity, ORDER], find: [OrderLineEntity, LINES] })
            const { receipts } = await build(em)

            const prepared = await receipts.prepareReceipt("o-1")

            expect(prepared).toEqual({ key: KEY, content: Buffer.from(JSON.stringify(DOCUMENT)) })
            expect(em.findOneBy).toHaveBeenCalledWith(OrderEntity, { id: "o-1", status: "paid" })
        })

        it("answers null for an order that does not exist or is not paid", async () => {
            const { receipts } = await build(mockEntityManager({ findOneBy: [OrderEntity, null] }))

            expect(await receipts.prepareReceipt("o-9")).toBeNull()
        })
    })

    describe("recordArchived", () => {
        it("remembers the key the receipt was stored under", async () => {
            const em = mockEntityManager({ update: [OrderEntity, {}] })
            const { receipts } = await build(em)

            await receipts.recordArchived({ orderId: "o-1", key: KEY })

            expect(em.update).toHaveBeenCalledWith(OrderEntity, { id: "o-1" }, { receiptKey: KEY })
        })
    })

    describe("link", () => {
        it("answers the link of an archived receipt of the buyer's own order", async () => {
            const em = mockEntityManager({ findOneBy: [OrderEntity, orderRow({ ...ORDER, receiptKey: KEY })] })
            const { receipts, storage } = await build(em)
            storage.linkOf.mockReturnValue(LINK)

            expect(await receipts.link({ personId: "p-1", orderId: "o-1" })).toSucceedWith(LINK)

            expect(em.findOneBy).toHaveBeenCalledWith(OrderEntity, { id: "o-1", personId: "p-1" })
            expect(storage.linkOf).toHaveBeenCalledWith(KEY)
        })

        it("refuses an order the buyer does not have", async () => {
            const { receipts } = await build(mockEntityManager({ findOneBy: [OrderEntity, null] }))

            expect(await receipts.link({ personId: "p-2", orderId: "o-1" })).toBeRefused({
                code: OrderErrorCode.ReceiptNotFound,
                params: { orderId: "o-1" },
            })
        })

        it("refuses as not ready while the receipt is not archived yet (the order is pending or the job has not run)", async () => {
            const { receipts, storage } = await build(mockEntityManager({ findOneBy: [OrderEntity, ORDER] }))

            expect(await receipts.link({ personId: "p-1", orderId: "o-1" })).toBeRefused({
                code: OrderErrorCode.ReceiptNotReady,
                params: { orderId: "o-1" },
            })
            expect(storage.linkOf).not.toHaveBeenCalled()
        })
    })
})
