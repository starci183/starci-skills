import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectReceiptStorage } from "@modules/integrations/receipt-storage"
import type { ReceiptLink, ReceiptStorage } from "@modules/integrations/receipt-storage"
import { InjectOrderEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { OrderErrorCode } from "./errors/order.error"
import type { ReceiptDocument, ReceiptLinkParams } from "./order.contracts"
import type { PreparedReceipt, RecordReceiptArchivedParams } from "./receipt.contracts"
import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"

@Injectable()
/**
 * The receipts of paid orders, archived in object storage outside the order database by the send-receipt job. `prepareReceipt`
 * builds the document of a paid order and `recordArchived` remembers the key the job stored it under; a buyer reads a receipt
 * through a time-limited link, only once the order is paid and its receipt archived.
 */
export class ReceiptService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        @InjectReceiptStorage() private readonly storage: ReceiptStorage,
    ) {}

    /** The receipt document of a paid order, or null when the order does not exist or is not paid. */
    async prepareReceipt(orderId: string): Promise<PreparedReceipt | null> {
        const order = await this.entityManager.findOneBy(OrderEntity, { id: orderId, status: "paid" })
        if (order === null) return null
        const document = await this.documentOf(order)
        return { key: `receipts/${order.id}.json`, content: Buffer.from(JSON.stringify(document)) }
    }

    /** Remembers the key an order's receipt was stored under. */
    async recordArchived(params: RecordReceiptArchivedParams): Promise<void> {
        await this.entityManager.update(OrderEntity, { id: params.orderId }, { receiptKey: params.key })
    }

    /** A download link of the buyer's own receipt, once the order is paid and its receipt archived. */
    async link(
        params: ReceiptLinkParams,
    ): Promise<Outcome<ReceiptLink, OrderErrorCode.ReceiptNotFound | OrderErrorCode.ReceiptNotReady>> {
        const order = await this.entityManager.findOneBy(OrderEntity, { id: params.orderId, personId: params.personId })
        if (order === null) return refused(OrderErrorCode.ReceiptNotFound, { orderId: params.orderId })
        return order.receiptKey === null
            ? refused(OrderErrorCode.ReceiptNotReady, { orderId: params.orderId })
            : ok(this.storage.linkOf(order.receiptKey))
    }

    private async documentOf(order: OrderEntity): Promise<ReceiptDocument> {
        // A cart lists at most LIST_ROWS_MAX lines, so an order never holds more.
        const lines = await this.entityManager.find(OrderLineEntity, {
            where: { orderId: order.id },
            order: { productId: "ASC" },
            take: LIST_ROWS_MAX,
        })
        return {
            orderId: order.id,
            personId: order.personId,
            lines: lines.map((line) => ({
                productId: line.productId,
                quantity: line.quantity,
                unitPriceMinorUnits: line.unitPriceMinorUnits,
            })),
            totalMinorUnits: order.totalMinorUnits,
            currency: order.currency,
            placedAt: order.createdAt.toISOString(),
        }
    }
}
