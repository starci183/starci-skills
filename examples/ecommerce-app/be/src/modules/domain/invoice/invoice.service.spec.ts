import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { BILLING_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { MESSAGE_PUBLISHER } from "@modules/integrations/messaging"
import type { MessagePublisher } from "@modules/integrations/messaging"
import { invoiceRow } from "@tests/fixtures/builders/invoice.builder"
import { InvoiceErrorCode } from "./errors/invoice.error"
import { INVOICE_ISSUED_QUEUE, INVOICE_REJECTED_QUEUE } from "./invoice.contracts"
import { INVOICE_OPTIONS } from "./invoice.decorators"
import type { InvoiceOptions } from "./invoice.options"
import { InvoiceService } from "./invoice.service"
import { InvoiceEntity } from "./persistence/entities/invoice.entity"

const AT = "2026-02-03T04:05:06.000Z"

const options = builder<InvoiceOptions>({ maxTotalMinorUnits: 10_000 })()

const request = { eventId: "o-1", orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 }

const build = async (entityManager: MockEntityManager, claimed = true) => {
    const inbox = mock<Inbox>()
    inbox.claim.mockResolvedValue(claimed)
    const messages = mock<MessagePublisher>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InvoiceService,
            { provide: BILLING_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: INBOX, useValue: inbox },
            { provide: MESSAGE_PUBLISHER, useValue: messages },
            { provide: INVOICE_OPTIONS, useValue: options },
        ],
    }).compile()
    return { service: moduleRef.get(InvoiceService), inbox, messages }
}

describe("InvoiceService", () => {
    describe("issue", () => {
        it("claims the event first, records an issued invoice stamped by the clock, announces it and answers it", async () => {
            const manager = mockEntityManager({ save: [InvoiceEntity, invoiceRow()] })
            const { service, inbox, messages } = await build(manager)

            const outcome = await service.issue(request)

            expect(outcome).toEqual({
                kind: "ok",
                value: { invoiceId: "inv-1", orderId: "o-1", totalMinorUnits: 1500 },
            })
            expect(inbox.claim).toHaveBeenCalledWith("order", "o-1")
            expect(manager.save).toHaveBeenCalledWith(InvoiceEntity, {
                orderId: "o-1",
                personId: "p-1",
                totalMinorUnits: 1500,
                status: "issued",
                createdAt: new Date(AT),
            })
            expect(messages.publish).toHaveBeenCalledWith({
                queue: INVOICE_ISSUED_QUEUE,
                eventId: "o-1",
                payload: { orderId: "o-1", totalMinorUnits: 1500 },
            })
        })

        it("records a total above the limit as rejected, announces it and refuses", async () => {
            const manager = mockEntityManager({
                save: [InvoiceEntity, invoiceRow({ status: "rejected", totalMinorUnits: 20_000 })],
            })
            const { service, messages } = await build(manager)

            const outcome = await service.issue({ ...request, totalMinorUnits: 20_000 })

            expect(outcome).toEqual({
                kind: "refused",
                code: InvoiceErrorCode.OverLimit,
                params: { orderId: "o-1" },
            })
            expect(manager.save).toHaveBeenCalledWith(InvoiceEntity, expect.objectContaining({ status: "rejected" }))
            expect(messages.publish).toHaveBeenCalledWith({
                queue: INVOICE_REJECTED_QUEUE,
                eventId: "o-1",
                payload: { orderId: "o-1", reason: InvoiceErrorCode.OverLimit, totalMinorUnits: 20_000 },
            })
        })

        it("answers the invoice already recorded for a redelivered event without writing again, announcing it again", async () => {
            const manager = mockEntityManager({ findOneByOrFail: [InvoiceEntity, invoiceRow()] })
            const { service, messages } = await build(manager, false)

            const outcome = await service.issue(request)

            expect(outcome).toEqual({
                kind: "ok",
                value: { invoiceId: "inv-1", orderId: "o-1", totalMinorUnits: 1500 },
            })
            expect(manager.findOneByOrFail).toHaveBeenCalledWith(InvoiceEntity, { orderId: "o-1" })
            expect(manager.save).not.toHaveBeenCalled()
            expect(messages.publish).toHaveBeenCalledTimes(1)
        })

        it("announces a rejected invoice again when its event is redelivered", async () => {
            const manager = mockEntityManager({
                findOneByOrFail: [InvoiceEntity, invoiceRow({ status: "rejected", totalMinorUnits: 20_000 })],
            })
            const { service, messages } = await build(manager, false)

            const outcome = await service.issue({ ...request, totalMinorUnits: 20_000 })

            expect(outcome.kind).toBe("refused")
            expect(messages.publish).toHaveBeenCalledTimes(1)
        })

        it("gives the claim back and rethrows when the invoice cannot be written", async () => {
            const failure = new Error("billing database down")
            const manager = mockEntityManager({ save: [InvoiceEntity, invoiceRow()] })
            manager.save.mockRejectedValueOnce(failure)
            const { service, inbox } = await build(manager)

            await expect(service.issue(request)).rejects.toBe(failure)
            expect(inbox.release).toHaveBeenCalledWith("order", "o-1")
        })
    })
})
