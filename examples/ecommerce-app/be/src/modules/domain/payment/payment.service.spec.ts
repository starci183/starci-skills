import { Test } from "@nestjs/testing"
import { FakeClock, fakeInbox, fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { INVOICE_SERVICE } from "@modules/domain/invoice"
import type { InvoiceService } from "@modules/domain/invoice"
import { PaymentConfirmedEvent, PaymentFailedEvent } from "@modules/events/billing"
import { CLOCK } from "@modules/platform/clock"
import { BILLING_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { INBOX } from "@modules/platform/inbox"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { paymentRow } from "@tests/fixtures/builders/payment.builder"
import type { BankTransferNotice } from "./payment.contracts"
import { PaymentLogEvent } from "./payment.log-events"
import { PaymentService } from "./payment.service"
import { PaymentEntity } from "./persistence/entities/payment.entity"

const AT = "2026-02-03T04:05:06.000Z"

const notice: BankTransferNotice = {
    eventId: "92704",
    code: "o-1",
    transferType: "in",
    transferAmount: 1500,
    referenceCode: "FT0000092704",
}

const openInvoice = { invoiceId: "inv-1", orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 }

const build = async (entityManager: MockEntityManager, claimed = true) => {
    const inbox = fakeInbox()
    if (!claimed) inbox.seen("sepay", "92704")
    const claim = jest.spyOn(inbox, "claim")
    const release = jest.spyOn(inbox, "release")
    const bus = recordingEventBus()
    const logger = mock<Logger>()
    const invoices = mock<InvoiceService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentService,
            { provide: BILLING_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: INBOX, useValue: inbox },
            { provide: EVENT_BUS, useValue: bus },
            { provide: LOGGER, useValue: logger },
            { provide: INVOICE_SERVICE, useValue: invoices },
        ],
    }).compile()
    return { service: moduleRef.get(PaymentService), inbox, claim, release, bus, logger, invoices }
}

describe("PaymentService", () => {
    describe("acceptBankTransfer", () => {
        it("claims the transfer, pays the invoice, records the payment and announces it with the same transaction manager", async () => {
            const tx = fakeTransaction(mockEntityManager({ save: [PaymentEntity, paymentRow()] }))
            const { service, inbox, claim, release, bus, invoices } = await build(tx.em)
            invoices.findOpen.mockResolvedValue(openInvoice)

            await service.acceptBankTransfer(notice)

            expect(inbox.claims).toEqual([{ source: "sepay", eventId: "92704" }])
            const manager = invoices.findOpen.mock.calls[0]?.[0]?.manager
            expect(manager).toBeDefined()
            expect(manager).not.toBe(tx.em)
            expect(claim).toHaveBeenCalledTimes(1)
            expect(claim).toHaveBeenCalledWith("sepay", "92704", manager)
            expect(release).not.toHaveBeenCalled()
            expect(invoices.findOpen).toHaveBeenCalledWith({ manager, orderId: "o-1" })
            expect(invoices.markPaid).toHaveBeenCalledWith({
                manager,
                orderId: "o-1",
                paidAt: new Date(AT),
            })
            expect(tx.em.save).toHaveBeenCalledWith(PaymentEntity, {
                invoiceId: "inv-1",
                orderId: "o-1",
                personId: "p-1",
                amountMinorUnits: 1500,
                providerReference: "FT0000092704",
                createdAt: new Date(AT),
            })
            expect(bus.writes).toEqual([
                PaymentConfirmedEvent.create({ orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 }),
            ])
            expect(bus.allInTransaction).toBe(true)
            expect(bus.entries[0]?.tx).toBe(manager)
            expect(tx.commits).toBe(1)
        })

        it("publishes a failure and changes nothing else when the transferred amount differs from the invoice total", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { service, bus, invoices } = await build(tx.em)
            invoices.findOpen.mockResolvedValue(openInvoice)

            await service.acceptBankTransfer({ ...notice, transferAmount: 1000 })

            expect(bus.writes).toEqual([
                PaymentFailedEvent.create({
                    orderId: "o-1",
                    reason: "amount-mismatch",
                    expectedMinorUnits: 1500,
                    receivedMinorUnits: 1000,
                }),
            ])
            expect(bus.allInTransaction).toBe(true)
            expect(invoices.markPaid).not.toHaveBeenCalled()
            expect(tx.em.save).not.toHaveBeenCalled()
        })

        it("commits a no-op transaction for an already claimed transfer without repeating its effect", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { service, inbox, release, bus, invoices } = await build(tx.em, false)

            await service.acceptBankTransfer(notice)

            expect(tx.em.transaction).toHaveBeenCalledTimes(1)
            expect(tx.commits).toBe(1)
            expect(tx.committedWrites).toEqual([])
            expect(inbox.claims).toEqual([{ source: "sepay", eventId: "92704" }])
            expect(release).not.toHaveBeenCalled()
            expect(invoices.findOpen).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
        })

        it("acknowledges and ignores a transfer that is not money received", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { service, bus, logger, invoices } = await build(tx.em)

            await service.acceptBankTransfer({ ...notice, transferType: "out" })

            expect(logger.info).toHaveBeenCalledWith(PaymentLogEvent.TransferIgnored, { transferId: "92704" })
            expect(invoices.findOpen).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
        })

        it("acknowledges and ignores a transfer that names no open invoice", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { service, bus, logger, invoices } = await build(tx.em)
            invoices.findOpen.mockResolvedValue(null)

            await service.acceptBankTransfer(notice)

            expect(logger.warn).toHaveBeenCalledWith(PaymentLogEvent.TransferUnmatched, {
                transferId: "92704",
                code: "o-1",
            })
            expect(bus.writes).toEqual([])
        })

        it("rolls back a failed announcement and propagates its error without compensating claim deletion", async () => {
            const failure = new Error("billing outbox down")
            const tx = fakeTransaction(mockEntityManager({ save: [PaymentEntity, paymentRow()] }))
            const { service, claim, release, bus, invoices } = await build(tx.em)
            invoices.findOpen.mockResolvedValue(openInvoice)
            bus.failNext("publish", failure)

            await expect(service.acceptBankTransfer(notice)).rejects.toBe(failure)

            const manager = invoices.findOpen.mock.calls[0]?.[0]?.manager
            expect(manager).toBeDefined()
            expect(manager).not.toBe(tx.em)
            expect(claim).toHaveBeenCalledWith("sepay", "92704", manager)
            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(tx.committedWrites).toEqual([])
            expect(tx.rolledBackWrites).toHaveLength(1)
            expect(release).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
        })

        it("rolls back a claim error before invoice work and propagates it without compensating deletion", async () => {
            const failure = new Error("billing claim unavailable")
            const tx = fakeTransaction(mockEntityManager())
            const { service, inbox, release, bus, invoices } = await build(tx.em)
            inbox.failNext("claim", failure)

            await expect(service.acceptBankTransfer(notice)).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(tx.committedWrites).toEqual([])
            expect(invoices.findOpen).not.toHaveBeenCalled()
            expect(release).not.toHaveBeenCalled()
            expect(bus.writes).toEqual([])
        })

        it("rolls back and propagates a database failure without compensating claim deletion", async () => {
            const failure = new Error("billing database down")
            const tx = fakeTransaction(mockEntityManager())
            const { service, release, invoices } = await build(tx.em)
            invoices.findOpen.mockRejectedValue(failure)

            await expect(service.acceptBankTransfer(notice)).rejects.toBe(failure)

            expect(release).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(tx.committedWrites).toEqual([])
        })
    })
})
