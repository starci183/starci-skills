import { Test } from "@nestjs/testing"
import { builder, FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { BILLING_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InvoiceIssuedEvent, InvoiceRejectedEvent } from "@modules/events/billing"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { invoiceRow } from "@tests/fixtures/builders/invoice.builder"
import { InvoiceErrorCode } from "./errors/invoice.error"
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
    const bus = mock<EventBus>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InvoiceService,
            { provide: BILLING_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: INBOX, useValue: inbox },
            { provide: EVENT_BUS, useValue: bus },
            { provide: INVOICE_OPTIONS, useValue: options },
        ],
    }).compile()
    return { service: moduleRef.get(InvoiceService), inbox, bus }
}

describe("InvoiceService", () => {
    describe("issue", () => {
        it("claims the event first, records an issued invoice and its announcement in one transaction and answers it", async () => {
            const tx = fakeTransaction(mockEntityManager({ save: [InvoiceEntity, invoiceRow()] }))
            const { service, inbox, bus } = await build(tx.em)

            const outcome = await service.issue(request)

            expect(outcome).toEqual({
                kind: "ok",
                value: { invoiceId: "inv-1", orderId: "o-1", totalMinorUnits: 1500 },
            })
            expect(inbox.claim).toHaveBeenCalledWith("order", "o-1")
            expect(tx.em.save).toHaveBeenCalledWith(InvoiceEntity, {
                orderId: "o-1",
                personId: "p-1",
                totalMinorUnits: 1500,
                status: "issued",
                createdAt: new Date(AT),
            })
            expect(bus.publish).toHaveBeenCalledWith(
                InvoiceIssuedEvent.create({ orderId: "o-1", totalMinorUnits: 1500 }),
                expect.anything(),
            )
            expect(tx.commits).toBe(1)
        })

        it("records a total above the limit as rejected, announces it in the same transaction and refuses", async () => {
            const tx = fakeTransaction(
                mockEntityManager({ save: [InvoiceEntity, invoiceRow({ status: "rejected", totalMinorUnits: 20_000 })] }),
            )
            const { service, bus } = await build(tx.em)

            const outcome = await service.issue({ ...request, totalMinorUnits: 20_000 })

            expect(outcome).toEqual({
                kind: "refused",
                code: InvoiceErrorCode.OverLimit,
                params: { orderId: "o-1" },
            })
            expect(tx.em.save).toHaveBeenCalledWith(InvoiceEntity, expect.objectContaining({ status: "rejected" }))
            expect(bus.publish).toHaveBeenCalledWith(
                InvoiceRejectedEvent.create({
                    orderId: "o-1",
                    reason: InvoiceErrorCode.OverLimit,
                    totalMinorUnits: 20_000,
                }),
                expect.anything(),
            )
            expect(tx.commits).toBe(1)
        })

        it("answers the invoice already recorded for a redelivered event without writing or announcing again", async () => {
            const manager = mockEntityManager({ findOneByOrFail: [InvoiceEntity, invoiceRow()] })
            const { service, bus } = await build(manager, false)

            const outcome = await service.issue(request)

            expect(outcome).toEqual({
                kind: "ok",
                value: { invoiceId: "inv-1", orderId: "o-1", totalMinorUnits: 1500 },
            })
            expect(manager.findOneByOrFail).toHaveBeenCalledWith(InvoiceEntity, { orderId: "o-1" })
            expect(manager.save).not.toHaveBeenCalled()
            expect(bus.publish).not.toHaveBeenCalled()
        })

        it("refuses a redelivered event of a rejected invoice without announcing it again", async () => {
            const manager = mockEntityManager({
                findOneByOrFail: [InvoiceEntity, invoiceRow({ status: "rejected", totalMinorUnits: 20_000 })],
            })
            const { service, bus } = await build(manager, false)

            const outcome = await service.issue({ ...request, totalMinorUnits: 20_000 })

            expect(outcome.kind).toBe("refused")
            expect(bus.publish).not.toHaveBeenCalled()
        })

        it("gives the claim back, rolls the transaction back and rethrows when the invoice cannot be written", async () => {
            const failure = new Error("billing database down")
            const tx = fakeTransaction(mockEntityManager({ save: [InvoiceEntity, invoiceRow()] }))
            tx.em.save.mockRejectedValueOnce(failure)
            const { service, inbox, bus } = await build(tx.em)

            await expect(service.issue(request)).rejects.toBe(failure)
            expect(inbox.release).toHaveBeenCalledWith("order", "o-1")
            expect(bus.publish).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
        })
    })
})
