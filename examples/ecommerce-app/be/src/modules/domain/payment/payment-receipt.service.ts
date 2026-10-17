import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BankTransferReceivedEvent } from "@modules/events/billing"
import { InjectBillingEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { BankTransferNotice } from "./payment.contracts"

@Injectable()
/** Records verified SePay deliveries and their outbox events without settling invoices. */
export class PaymentReceiptService {
    constructor(
        @InjectBillingEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectEventBus() private readonly bus: EventBus,
    ) {}

    /** Claims the delivery and publishes its typed event atomically; repeats are acknowledged. */
    async recordBankTransfer(notice: BankTransferNotice): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            if (!(await this.inbox.claim("sepay", notice.eventId, manager))) return
            await this.bus.publish(BankTransferReceivedEvent.create(notice), manager)
        })
    }
}
