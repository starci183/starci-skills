import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
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
        it("claims the event first, records an issued invoice stamped by the clock, announces it and answers it", async () => {
            const manager = mockEntityManager({ save: [InvoiceEntity, invoiceRow()] })
            const { service, inbox, bus } = await build(manager)

            const outcome = await service.issue(request)

            expect(outcome).toEqual({
                kind: "ok",
                value: { invoiceId: "inv-1", orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 },
            })
            expect(inbox.claim).toHaveBeenCalledWith("order", "o-1")
            expect(manager.save).toHaveBeenCalledWith(InvoiceEntity, {
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
        })

        it("records a total above the limit as rejected, announces it and refuses", async () => {
            const manager = mockEntityManager({
                save: [InvoiceEntity, invoiceRow({ status: "rejected", totalMinorUnits: 20_000 })],
            })
            const { service, bus } = await build(manager)

            const outcome = await service.issue({ ...request, totalMinorUnits: 20_000 })

            expect(outcome).toEqual({
                kind: "refused",
                code: InvoiceErrorCode.OverLimit,
                params: { orderId: "o-1" },
            })
            expect(manager.save).toHaveBeenCalledWith(InvoiceEntity, expect.objectContaining({ status: "rejected" }))
            expect(bus.publish).toHaveBeenCalledWith(
                InvoiceRejectedEvent.create({
                    orderId: "o-1",
                    reason: InvoiceErrorCode.OverLimit,
                    totalMinorUnits: 20_000,
                }),
                expect.anything(),
            )
        })

        it("answers the invoice already recorded for a redelivered event without writing again, announcing it again", async () => {
            const manager = mockEntityManager({ findOneByOrFail: [InvoiceEntity, invoiceRow()] })
            const { service, bus } = await build(manager, false)

            const outcome = await service.issue(request)

            expect(outcome).toEqual({
                kind: "ok",
                value: { invoiceId: "inv-1", orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 },
            })
            expect(manager.findOneByOrFail).toHaveBeenCalledWith(InvoiceEntity, { orderId: "o-1" })
            expect(manager.save).not.toHaveBeenCalled()
            expect(bus.publish).toHaveBeenCalledTimes(1)
        })

        it("announces a rejected invoice again when its event is redelivered", async () => {
            const manager = mockEntityManager({
                findOneByOrFail: [InvoiceEntity, invoiceRow({ status: "rejected", totalMinorUnits: 20_000 })],
            })
            const { service, bus } = await build(manager, false)

            const outcome = await service.issue({ ...request, totalMinorUnits: 20_000 })

            expect(outcome.kind).toBe("refused")
            expect(bus.publish).toHaveBeenCalledTimes(1)
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
