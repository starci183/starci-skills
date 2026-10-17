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

/** The processing inbox source, separate from the SePay delivery receipt. */
const SETTLEMENT_SOURCE = "billing.bank-transfer-received"

/** Why a transfer that names an open invoice does not pay it. */
const AMOUNT_MISMATCH = "amount-mismatch"

@Injectable()
/** Settles committed bank-transfer events in an idempotent billing transaction. */
export class PaymentService {
    constructor(
        @InjectBillingEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectEventBus() private readonly bus: EventBus,
        @InjectLogger() private readonly logger: Logger,
        @InjectInvoiceService() private readonly invoices: InvoiceService,
    ) {}

    /** Commits the processing claim, payment and outcome of one received transfer together. */
    async acceptBankTransfer(notice: BankTransferNotice): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            if (!(await this.inbox.claim(SETTLEMENT_SOURCE, notice.eventId, manager))) return
            await this.settle(manager, notice)
        })
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
