import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectInvoiceService } from "@modules/domain/invoice"
import type { InvoiceService } from "@modules/domain/invoice"
import { PaymentConfirmedEvent, PaymentFailedEvent } from "@modules/events/billing"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectBillingEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { BankTransferNotice } from "./payment.contracts"
import { PaymentLogEvent } from "./payment.log-events"
import { PaymentEntity } from "./persistence/entities/payment.entity"

/** The inbox source of the transfers the bank transfer notifier delivers. */
const NOTIFIER_SOURCE = "sepay"

/** Why a transfer that names an open invoice does not pay it. */
const AMOUNT_MISMATCH = "amount-mismatch"

@Injectable()
/**
 * The intake of the bank transfer notifier. `acceptBankTransfer` takes a verified delivery: it claims the transfer in the
 * inbox first, so a redelivery does nothing, then in ONE transaction matches the transfer to the open invoice of the order
 * its payment code names and publishes the outcome: `billing.payment-confirmed` when the amount equals the invoice total
 * (the invoice is marked paid and a payment record is written), `billing.payment-failed` when it differs (nothing else
 * changes, the invoice stays open for a correct transfer). A transfer that is not money received, or names no open
 * invoice, is acknowledged and ignored.
 */
export class PaymentService {
    constructor(
        @InjectBillingEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectEventBus() private readonly bus: EventBus,
        @InjectLogger() private readonly logger: Logger,
        @InjectInvoiceService() private readonly invoices: InvoiceService,
    ) {}

    /** Records the effect of one verified bank transfer notice exactly once. */
    async acceptBankTransfer(notice: BankTransferNotice): Promise<void> {
        if (!(await this.inbox.claim(NOTIFIER_SOURCE, notice.eventId))) return
        try {
            await this.entityManager.transaction((manager) => this.settle(manager, notice))
        } catch (error) {
            await this.inbox.release(NOTIFIER_SOURCE, notice.eventId)
            throw error
        }
    }

    /** The decision of one claimed notice, inside the transaction that records and publishes its outcome. */
    private async settle(manager: EntityManager, notice: BankTransferNotice): Promise<void> {
        if (notice.transferType !== "in") {
            this.logger.info(PaymentLogEvent.TransferIgnored, { transferId: notice.eventId })
            return
        }
        const invoice = await this.invoices.findOpen({ manager, orderId: notice.code })
        if (invoice === null) {
            this.logger.warn(PaymentLogEvent.TransferUnmatched, { transferId: notice.eventId, code: notice.code })
            return
        }
        if (invoice.totalMinorUnits !== notice.transferAmount) {
            await this.bus.publish(
                PaymentFailedEvent.create({
                    orderId: invoice.orderId,
                    reason: AMOUNT_MISMATCH,
                    expectedMinorUnits: invoice.totalMinorUnits,
                    receivedMinorUnits: notice.transferAmount,
                }),
                manager,
            )
            return
        }
        const at = this.clock.now()
        await this.invoices.markPaid({ manager, orderId: invoice.orderId, paidAt: at })
        await manager.save(
            PaymentEntity,
            manager.create(PaymentEntity, {
                invoiceId: invoice.invoiceId,
                orderId: invoice.orderId,
                personId: invoice.personId,
                amountMinorUnits: notice.transferAmount,
                providerReference: notice.referenceCode,
                createdAt: at,
            }),
        )
        await this.bus.publish(
            PaymentConfirmedEvent.create({
                orderId: invoice.orderId,
                personId: invoice.personId,
                totalMinorUnits: notice.transferAmount,
            }),
            manager,
        )
    }
}
