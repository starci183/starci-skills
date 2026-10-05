import { Test } from "@nestjs/testing"
import {
    builder,
    FakeClock,
    fakeInbox,
    fakeTransaction,
    mockEntityManager,
    recordingEventBus,
} from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { BILLING_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
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
    const inbox = fakeInbox()
    if (!claimed) inbox.seen("order", "o-1")
    const claim = jest.spyOn(inbox, "claim")
    const release = jest.spyOn(inbox, "release")
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
    return { service: moduleRef.get(InvoiceService), inbox, claim, release, bus }
}

describe("InvoiceService", () => {
    describe("issue", () => {
        it("claims, writes and announces an issued invoice through one transaction manager and answers it", async () => {
            const tx = fakeTransaction(mockEntityManager({ save: [InvoiceEntity, invoiceRow()] }))
            const { service, inbox, claim, release, bus } = await build(tx.em)

            const outcome = await service.issue(request)

            expect(outcome).toEqual({
                kind: "ok",
                value: { invoiceId: "inv-1", orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 },
            })
            expect(inbox.claims).toEqual([{ source: "order", eventId: "o-1" }])
            const manager = bus.entries[0]?.tx
            expect(manager).toBeDefined()
            expect(manager).not.toBe(tx.em)
            expect(claim).toHaveBeenCalledTimes(1)
            expect(claim).toHaveBeenCalledWith("order", "o-1", manager)
            expect(release).not.toHaveBeenCalled()
            expect(tx.em.save).toHaveBeenCalledWith(InvoiceEntity, {
                orderId: "o-1",
                personId: "p-1",
                totalMinorUnits: 1500,
                status: "issued",
                createdAt: new Date(AT),
            })
            expect(tx.committedWrites).toHaveLength(1)
            expect(tx.committedWrites[0]?.method).toBe("save")
            expect(tx.committedWrites[0]?.args[0]).toBe(InvoiceEntity)
            expect(bus.writes).toEqual([InvoiceIssuedEvent.create({ orderId: "o-1", totalMinorUnits: 1500 })])
            expect(bus.allInTransaction).toBe(true)
            expect(tx.em.transaction).toHaveBeenCalledTimes(1)
            expect(tx.commits).toBe(1)
        })

        it("records a total above the limit as rejected, announces it with the claim manager and refuses", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    save: [InvoiceEntity, invoiceRow({ status: "rejected", totalMinorUnits: 20_000 })],
                }),
            )
            const { service, claim, release, bus } = await build(tx.em)

            const outcome = await service.issue({ ...request, totalMinorUnits: 20_000 })

            expect(outcome).toEqual({
                kind: "refused",
                code: InvoiceErrorCode.OverLimit,
                params: { orderId: "o-1" },
            })
            const manager = bus.entries[0]?.tx
            expect(manager).toBeDefined()
            expect(manager).not.toBe(tx.em)
            expect(claim).toHaveBeenCalledWith("order", "o-1", manager)
            expect(release).not.toHaveBeenCalled()
            expect(tx.em.save).toHaveBeenCalledWith(InvoiceEntity, expect.objectContaining({ status: "rejected" }))
            expect(tx.committedWrites).toHaveLength(1)
            expect(bus.writes).toEqual([
                InvoiceRejectedEvent.create({
                    orderId: "o-1",
                    reason: InvoiceErrorCode.OverLimit,
                    totalMinorUnits: 20_000,
                }),
            ])
            expect(bus.allInTransaction).toBe(true)
            expect(tx.em.transaction).toHaveBeenCalledTimes(1)
            expect(tx.commits).toBe(1)
        })

        it("reads the committed invoice of a duplicate through its claim transaction without writing or announcing again", async () => {
            const tx = fakeTransaction(mockEntityManager({ findOneByOrFail: [InvoiceEntity, invoiceRow()] }))
            const { service, claim, release, bus } = await build(tx.em, false)

            const outcome = await service.issue(request)

            expect(outcome).toEqual({
                kind: "ok",
                value: { invoiceId: "inv-1", orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 },
            })
            expect(tx.em.findOneByOrFail).toHaveBeenCalledWith(InvoiceEntity, { orderId: "o-1" })
            expect(tx.em.findOneByOrFail.mock.contexts[0]).toBeDefined()
            expect(tx.em.findOneByOrFail.mock.contexts[0]).not.toBe(tx.em)
            expect(claim).toHaveBeenCalledWith("order", "o-1", tx.em.findOneByOrFail.mock.contexts[0])
            expect(tx.em.save).not.toHaveBeenCalled()
            expect(tx.em.transaction).toHaveBeenCalledTimes(1)
            expect(tx.commits).toBe(1)
            expect(tx.committedWrites).toEqual([])
            expect(release).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
        })

        it("reads a duplicate rejected invoice in the claim transaction and refuses without another announcement", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    findOneByOrFail: [InvoiceEntity, invoiceRow({ status: "rejected", totalMinorUnits: 20_000 })],
                }),
            )
            const { service, claim, release, bus } = await build(tx.em, false)

            const outcome = await service.issue({ ...request, totalMinorUnits: 20_000 })

            expect(outcome).toEqual({
                kind: "refused",
                code: InvoiceErrorCode.OverLimit,
                params: { orderId: "o-1" },
            })
            expect(tx.em.findOneByOrFail.mock.contexts[0]).toBeDefined()
            expect(tx.em.findOneByOrFail.mock.contexts[0]).not.toBe(tx.em)
            expect(claim).toHaveBeenCalledWith("order", "o-1", tx.em.findOneByOrFail.mock.contexts[0])
            expect(tx.em.save).not.toHaveBeenCalled()
            expect(tx.commits).toBe(1)
            expect(tx.committedWrites).toEqual([])
            expect(release).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
        })

        it("rolls back an invoice write error and preserves it without compensating claim deletion", async () => {
            const failure = new Error("billing database down")
            const tx = fakeTransaction(mockEntityManager({ save: [InvoiceEntity, invoiceRow()] }))
            tx.em.save.mockRejectedValueOnce(failure)
            const { service, inbox, release, bus } = await build(tx.em)
            inbox.failNext("release", new Error("compensating deletion must not run"))

            await expect(service.issue(request)).rejects.toBe(failure)

            expect(release).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(tx.committedWrites).toEqual([])
            expect(tx.rolledBackWrites).toHaveLength(1)
        })

        it("rolls back an announcement error and preserves it without compensating claim deletion", async () => {
            const failure = new Error("billing outbox down")
            const tx = fakeTransaction(mockEntityManager({ save: [InvoiceEntity, invoiceRow()] }))
            const { service, inbox, release, bus } = await build(tx.em)
            inbox.failNext("release", new Error("compensating deletion must not run"))
            bus.failNext("publish", failure)

            await expect(service.issue(request)).rejects.toBe(failure)

            expect(release).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(tx.committedWrites).toEqual([])
            expect(tx.rolledBackWrites).toHaveLength(1)
            expect(bus.writes).toEqual([])
        })

        it("rolls back a failed claim before any invoice or announcement and preserves the claim error", async () => {
            const failure = new Error("claim unavailable")
            const tx = fakeTransaction(mockEntityManager())
            const { service, inbox, release, bus } = await build(tx.em)
            inbox.failNext("claim", failure)

            await expect(service.issue(request)).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(tx.em.save).not.toHaveBeenCalled()
            expect(tx.em.findOneByOrFail).not.toHaveBeenCalled()
            expect(release).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
        })

        it("rolls back a duplicate invoice read error without writing, announcing or compensating", async () => {
            const failure = new Error("duplicate invoice read failed")
            const tx = fakeTransaction(mockEntityManager({ findOneByOrFail: [InvoiceEntity, invoiceRow()] }))
            tx.em.findOneByOrFail.mockRejectedValueOnce(failure)
            const { service, release, bus } = await build(tx.em, false)

            await expect(service.issue(request)).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(tx.committedWrites).toEqual([])
            expect(tx.em.save).not.toHaveBeenCalled()
            expect(release).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
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
            const manager = mockEntityManager({ update: [InvoiceEntity, { affected: 1 }] })
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
