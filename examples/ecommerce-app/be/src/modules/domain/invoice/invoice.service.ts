import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectBillingEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InjectMessagePublisher } from "@modules/integrations/messaging"
import type { MessagePublisher } from "@modules/integrations/messaging"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { InvoiceErrorCode } from "./errors/invoice.error"
import { INVOICE_REJECTED_QUEUE } from "./invoice.contracts"
import type { InvoiceView, IssueInvoiceParams } from "./invoice.contracts"
import { InjectInvoiceOptions } from "./invoice.decorators"
import type { InvoiceOptions } from "./invoice.options"
import { InvoiceEntity } from "./persistence/entities/invoice.entity"

/** The inbox source of the events this service consumes from the order service. */
const ORDER_SOURCE = "order"

const toView = (row: InvoiceEntity): InvoiceView => ({
    invoiceId: row.id,
    orderId: row.orderId,
    totalMinorUnits: row.totalMinorUnits,
})

@Injectable()
/**
 * Issues one invoice per placed order. `issue` takes a delivery: it claims the event in the inbox first, so a redelivery
 * answers the invoice already recorded instead of billing twice. A total above the limit is recorded as a rejected
 * invoice and announced as `billing.invoice-rejected`, which the order service compensates; a replay of a rejected
 * delivery announces it again, so a failed announcement is repaired by the retry.
 */
export class InvoiceService {
    constructor(
        @InjectBillingEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectMessagePublisher() private readonly messages: MessagePublisher,
        @InjectInvoiceOptions() private readonly options: InvoiceOptions,
    ) {}

    /** Records the invoice of a placed order once; answers it, or the refusal of an order above the limit. */
    async issue(params: IssueInvoiceParams): Promise<Outcome<InvoiceView, InvoiceErrorCode.OverLimit>> {
        if (!(await this.inbox.claim(ORDER_SOURCE, params.eventId))) {
            return this.outcomeOf(await this.entityManager.findOneByOrFail(InvoiceEntity, { orderId: params.orderId }))
        }
        return this.outcomeOf(await this.record(params))
    }

    /** Writes the invoice row; a failed write gives the claim back so the redelivery is processed again. */
    private async record(params: IssueInvoiceParams): Promise<InvoiceEntity> {
        try {
            return await this.entityManager.save(
                InvoiceEntity,
                this.entityManager.create(InvoiceEntity, {
                    orderId: params.orderId,
                    personId: params.personId,
                    totalMinorUnits: params.totalMinorUnits,
                    status: params.totalMinorUnits > this.options.maxTotalMinorUnits ? "rejected" : "issued",
                    createdAt: this.clock.now(),
                }),
            )
        } catch (error) {
            await this.inbox.release(ORDER_SOURCE, params.eventId)
            throw error
        }
    }

    /** The outcome of a recorded invoice; a rejected one is announced to the order service. */
    private async outcomeOf(row: InvoiceEntity): Promise<Outcome<InvoiceView, InvoiceErrorCode.OverLimit>> {
        if (row.status === "issued") return ok(toView(row))
        await this.messages.publish({
            queue: INVOICE_REJECTED_QUEUE,
            eventId: row.orderId,
            payload: { orderId: row.orderId, reason: InvoiceErrorCode.OverLimit, totalMinorUnits: row.totalMinorUnits },
        })
        return refused(InvoiceErrorCode.OverLimit, { orderId: row.orderId })
    }
}
