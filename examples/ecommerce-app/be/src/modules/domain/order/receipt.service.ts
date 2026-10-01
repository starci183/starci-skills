import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPaymentService } from "@modules/domain/payment"
import type { PaymentService } from "@modules/domain/payment"
import { InjectReceiptStorage } from "@modules/integrations/receipt-storage"
import type { ReceiptLink, ReceiptStorage } from "@modules/integrations/receipt-storage"
import { InjectOrderEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { OrderError, OrderErrorCode } from "./errors/order.error"
import type { ArchivedReceiptKey, ReceiptDocument, ReceiptLinkParams } from "./order.contracts"
import { OrderLogEvent } from "./order.log-events"
import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"

@Injectable()
/**
 * The receipts of placed orders, archived in object storage outside the order database. An order archives its receipt
 * right after it commits; the order never waits on the archive, so a storage that is down only delays the receipt: it is
 * archived on the buyer's first request for it instead. A buyer reads a receipt through a time-limited link.
 */
export class ReceiptService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        @InjectReceiptStorage() private readonly storage: ReceiptStorage,
        @InjectPaymentService() private readonly payments: PaymentService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Archives the receipt of a committed order and records its key; a failure is logged and answers null. */
    async archive(orderId: string): Promise<ArchivedReceiptKey> {
        const order = await this.entityManager.findOneBy(OrderEntity, { id: orderId })
        return order === null ? null : this.archiveOrder(order)
    }

    /** A download link of the buyer's own receipt, archiving it first when the order has none yet. */
    async link(
        params: ReceiptLinkParams,
    ): Promise<Outcome<ReceiptLink, OrderErrorCode.ReceiptNotFound | OrderErrorCode.ReceiptNotReady>> {
        const order = await this.entityManager.findOneBy(OrderEntity, { id: params.orderId, personId: params.personId })
        if (order === null) return refused(OrderErrorCode.ReceiptNotFound, { orderId: params.orderId })
        const key = order.receiptKey ?? (await this.archiveOrder(order))
        return key === null
            ? refused(OrderErrorCode.ReceiptNotReady, { orderId: params.orderId })
            : ok(this.storage.linkOf(key))
    }

    private async archiveOrder(order: OrderEntity): Promise<ArchivedReceiptKey> {
        const key = `receipts/${order.id}.json`
        try {
            const document = await this.documentOf(order)
            await this.storage.store({ key, content: Buffer.from(JSON.stringify(document)) })
            await this.entityManager.update(OrderEntity, { id: order.id }, { receiptKey: key })
            return key
        } catch (cause) {
            this.logger.error(OrderLogEvent.ReceiptArchiveFailed, cause, { orderId: order.id })
            return null
        }
    }

    private async documentOf(order: OrderEntity): Promise<ReceiptDocument> {
        // A cart lists at most LIST_ROWS_MAX lines, so an order never holds more.
        const lines = await this.entityManager.find(OrderLineEntity, {
            where: { orderId: order.id },
            order: { productId: "ASC" },
            take: LIST_ROWS_MAX,
        })
        const payment = await this.payments.findByOrder({ orderId: order.id })
        if (payment === null)
            throw new OrderError({ code: OrderErrorCode.PaymentMissing, params: { orderId: order.id } })
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
            paymentId: payment.paymentId,
            placedAt: order.createdAt.toISOString(),
        }
    }
}
