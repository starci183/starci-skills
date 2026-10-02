import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectBillingEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InvoiceIssuedEvent, InvoiceRejectedEvent } from "@modules/events/billing"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { BaseEvent, EventBus } from "@modules/platform/event-bus"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { InvoiceErrorCode } from "./errors/invoice.error"
import type {
    FindOpenInvoiceParams,
    FindOpenInvoiceResult,
    InvoiceView,
    IssueInvoiceParams,
    MarkInvoicePaidParams,
} from "./invoice.contracts"
import { InjectInvoiceOptions } from "./invoice.decorators"
import type { InvoiceOptions } from "./invoice.options"
import { InvoiceEntity } from "./persistence/entities/invoice.entity"

/** The inbox source of the events this service consumes from the order service. */
const ORDER_SOURCE = "order"

const toView = (row: InvoiceEntity): InvoiceView => ({
    invoiceId: row.id,
    orderId: row.orderId,
    personId: row.personId,
    totalMinorUnits: row.totalMinorUnits,
})

@Injectable()
/**
 * Issues one invoice per placed order. `issue` takes a delivery: it claims the event in the inbox first, so a redelivery
 * answers the invoice already recorded instead of billing twice. The invoice and its announcement are written in one
 * transaction (the announcement is an outbox row, so it cannot be lost or sent for a rolled-back invoice): an issued
 * invoice is announced as `billing.invoice-issued`, a total above the limit is recorded as a rejected invoice and
 * announced as `billing.invoice-rejected`, which the order service compensates.
 */
export class InvoiceService {
    constructor(
        @InjectBillingEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectEventBus() private readonly bus: EventBus,
        @InjectInvoiceOptions() private readonly options: InvoiceOptions,
    ) {}

    /** Records the invoice of a placed order once; answers it, or the refusal of an order above the limit. */
    async issue(params: IssueInvoiceParams): Promise<Outcome<InvoiceView, InvoiceErrorCode.OverLimit>> {
        if (!(await this.inbox.claim(ORDER_SOURCE, params.eventId))) {
            return this.outcomeOf(await this.entityManager.findOneByOrFail(InvoiceEntity, { orderId: params.orderId }))
        }
        return this.outcomeOf(await this.record(params))
    }

    /** The issued, still unpaid invoice of an order, read with the manager of the caller transaction; null when the order has none. */
    async findOpen(params: FindOpenInvoiceParams): Promise<FindOpenInvoiceResult> {
        const row = await params.manager.findOneBy(InvoiceEntity, { orderId: params.orderId, status: "issued" })
        return row === null ? null : toView(row)
    }

    /** Marks the issued invoice of an order paid in the caller transaction; a no-op for an invoice that is not issued. */
    async markPaid(params: MarkInvoicePaidParams): Promise<void> {
        await params.manager.update(
            InvoiceEntity,
            { orderId: params.orderId, status: "issued" },
            { status: "paid", paidAt: params.paidAt },
        )
    }

    /** Writes the invoice row and the outbox row of its announcement in one transaction; a failed write gives the claim back so the redelivery is processed again. */
    private async record(params: IssueInvoiceParams): Promise<InvoiceEntity> {
        try {
            return await this.entityManager.transaction(async (manager) => {
                const row = await manager.save(
                    InvoiceEntity,
                    manager.create(InvoiceEntity, {
                        orderId: params.orderId,
                        personId: params.personId,
                        totalMinorUnits: params.totalMinorUnits,
                        status: params.totalMinorUnits > this.options.maxTotalMinorUnits ? "rejected" : "issued",
                        createdAt: this.clock.now(),
                    }),
                )
                await this.bus.publish(this.announcementOf(row), manager)
                return row
            })
        } catch (error) {
            await this.inbox.release(ORDER_SOURCE, params.eventId)
            throw error
        }
    }

    /** The event that tells the order service what became of the invoice: issued, or rejected (which compensates the order). */
    private announcementOf(row: InvoiceEntity): BaseEvent {
        return row.status === "issued"
            ? InvoiceIssuedEvent.create({ orderId: row.orderId, totalMinorUnits: row.totalMinorUnits })
            : InvoiceRejectedEvent.create({
                  orderId: row.orderId,
                  reason: InvoiceErrorCode.OverLimit,
                  totalMinorUnits: row.totalMinorUnits,
              })
    }

    /** The outcome of a recorded invoice. */
    private outcomeOf(row: InvoiceEntity): Outcome<InvoiceView, InvoiceErrorCode.OverLimit> {
        return row.status === "issued" ? ok(toView(row)) : refused(InvoiceErrorCode.OverLimit, { orderId: row.orderId })
    }
}
