import { Test } from "@nestjs/testing"
import { builder, FakeClock, fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { BILLING_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InvoiceIssuedEvent, InvoiceRejectedEvent } from "@modules/events/billing"
import { EVENT_BUS } from "@modules/platform/event-bus"
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
    const bus = recordingEventBus()
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
                value: { invoiceId: "inv-1", orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 },
            })
            expect(inbox.claim).toHaveBeenCalledWith("order", "o-1")
            expect(tx.em.save).toHaveBeenCalledWith(InvoiceEntity, {
                orderId: "o-1",
                personId: "p-1",
                totalMinorUnits: 1500,
                status: "issued",
                createdAt: new Date(AT),
            })
            expect(bus.writes).toEqual([InvoiceIssuedEvent.create({ orderId: "o-1", totalMinorUnits: 1500 })])
            expect(bus.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("records a total above the limit as rejected, announces it in the same transaction and refuses", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    save: [InvoiceEntity, invoiceRow({ status: "rejected", totalMinorUnits: 20_000 })],
                }),
            )
            const { service, bus } = await build(tx.em)

            const outcome = await service.issue({ ...request, totalMinorUnits: 20_000 })

            expect(outcome).toEqual({
                kind: "refused",
                code: InvoiceErrorCode.OverLimit,
                params: { orderId: "o-1" },
            })
            expect(tx.em.save).toHaveBeenCalledWith(InvoiceEntity, expect.objectContaining({ status: "rejected" }))
            expect(bus.writes).toEqual([
                InvoiceRejectedEvent.create({
                    orderId: "o-1",
                    reason: InvoiceErrorCode.OverLimit,
                    totalMinorUnits: 20_000,
                }),
            ])
            expect(bus.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("answers the invoice already recorded for a redelivered event without writing or announcing again", async () => {
            const manager = mockEntityManager({ findOneByOrFail: [InvoiceEntity, invoiceRow()] })
            const { service, bus } = await build(manager, false)

            const outcome = await service.issue(request)

            expect(outcome).toEqual({
                kind: "ok",
                value: { invoiceId: "inv-1", orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 },
            })
            expect(manager.findOneByOrFail).toHaveBeenCalledWith(InvoiceEntity, { orderId: "o-1" })
            expect(manager.save).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
        })

        it("refuses a redelivered event of a rejected invoice without announcing it again", async () => {
            const manager = mockEntityManager({
                findOneByOrFail: [InvoiceEntity, invoiceRow({ status: "rejected", totalMinorUnits: 20_000 })],
            })
            const { service, bus } = await build(manager, false)

            const outcome = await service.issue({ ...request, totalMinorUnits: 20_000 })

            expect(outcome.kind).toBe("refused")
            expect(bus.writes).toEqual([])
        })

        it("gives the claim back, rolls the transaction back and rethrows when the invoice cannot be written", async () => {
            const failure = new Error("billing database down")
            const tx = fakeTransaction(mockEntityManager({ save: [InvoiceEntity, invoiceRow()] }))
            tx.em.save.mockRejectedValueOnce(failure)
            const { service, inbox, bus } = await build(tx.em)

            await expect(service.issue(request)).rejects.toBe(failure)
            expect(inbox.release).toHaveBeenCalledWith("order", "o-1")
            expect(bus.writes).toEqual([])
            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("findOpen", () => {
        it("answers the issued, unpaid invoice of the order read with the manager of the caller", async () => {
            const manager = mockEntityManager({ findOneBy: [InvoiceEntity, invoiceRow()] })
            const { service } = await build(mockEntityManager())

            const found = await service.findOpen({ manager, orderId: "o-1" })

            expect(found).toEqual({ invoiceId: "inv-1", orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 })
            expect(manager.findOneBy).toHaveBeenCalledWith(InvoiceEntity, { orderId: "o-1", status: "issued" })
        })

        it("answers null when the order has no issued invoice", async () => {
            const manager = mockEntityManager({ findOneBy: [InvoiceEntity, null] })
            const { service } = await build(mockEntityManager())

            expect(await service.findOpen({ manager, orderId: "o-9" })).toBeNull()
        })
    })

    describe("markPaid", () => {
        it("marks only the issued invoice of the order paid, stamped with the time the caller gives, in the caller transaction", async () => {
            const manager = mockEntityManager()
            const { service } = await build(mockEntityManager())

            await service.markPaid({ manager, orderId: "o-1", paidAt: new Date(AT) })

            expect(manager.update).toHaveBeenCalledWith(
                InvoiceEntity,
                { orderId: "o-1", status: "issued" },
                { status: "paid", paidAt: new Date(AT) },
            )
        })
    })
})
