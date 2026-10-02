import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { INVOICE_SERVICE } from "@modules/domain/invoice"
import type { InvoiceService } from "@modules/domain/invoice"
import { PaymentConfirmedEvent, PaymentFailedEvent } from "@modules/events/billing"
import { CLOCK } from "@modules/platform/clock"
import { BILLING_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
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
    const inbox = mock<Inbox>()
    inbox.claim.mockResolvedValue(claimed)
    const bus = mock<EventBus>()
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
    return { service: moduleRef.get(PaymentService), inbox, bus, logger, invoices }
}

describe("PaymentService", () => {
    describe("acceptBankTransfer", () => {
        it("claims the transfer first, then marks the invoice paid, records the payment and publishes the confirmation in one committed transaction", async () => {
            const tx = fakeTransaction(mockEntityManager({ save: [PaymentEntity, paymentRow()] }))
            const { service, inbox, bus, invoices } = await build(tx.em)
            invoices.findOpen.mockResolvedValue(openInvoice)

            await service.acceptBankTransfer(notice)

            expect(inbox.claim).toHaveBeenCalledWith("sepay", "92704")
            expect(invoices.findOpen).toHaveBeenCalledWith({ manager: expect.anything(), orderId: "o-1" })
            expect(invoices.markPaid).toHaveBeenCalledWith({
                manager: expect.anything(),
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
            expect(bus.publish).toHaveBeenCalledWith(
                PaymentConfirmedEvent.create({ orderId: "o-1", personId: "p-1", totalMinorUnits: 1500 }),
                expect.anything(),
            )
            expect(tx.commits).toBe(1)
        })

        it("publishes a failure and changes nothing else when the transferred amount differs from the invoice total", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { service, bus, invoices } = await build(tx.em)
            invoices.findOpen.mockResolvedValue(openInvoice)

            await service.acceptBankTransfer({ ...notice, transferAmount: 1000 })

            expect(bus.publish).toHaveBeenCalledWith(
                PaymentFailedEvent.create({
                    orderId: "o-1",
                    reason: "amount-mismatch",
                    expectedMinorUnits: 1500,
                    receivedMinorUnits: 1000,
                }),
                expect.anything(),
            )
            expect(invoices.markPaid).not.toHaveBeenCalled()
            expect(tx.em.save).not.toHaveBeenCalled()
        })

        it("does nothing for a delivery whose transfer was already claimed", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { service, bus, invoices } = await build(tx.em, false)

            await service.acceptBankTransfer(notice)

            expect(tx.em.transaction).not.toHaveBeenCalled()
            expect(invoices.findOpen).not.toHaveBeenCalled()
            expect(bus.publish).not.toHaveBeenCalled()
        })

        it("acknowledges and ignores a transfer that is not money received", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { service, bus, logger, invoices } = await build(tx.em)

            await service.acceptBankTransfer({ ...notice, transferType: "out" })

            expect(logger.info).toHaveBeenCalledWith(PaymentLogEvent.TransferIgnored, { transferId: "92704" })
            expect(invoices.findOpen).not.toHaveBeenCalled()
            expect(bus.publish).not.toHaveBeenCalled()
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
            expect(bus.publish).not.toHaveBeenCalled()
        })

        it("gives the claim back and rethrows when the transaction fails, so the redelivery is processed again", async () => {
            const failure = new Error("billing database down")
            const tx = fakeTransaction(mockEntityManager())
            const { service, inbox, invoices } = await build(tx.em)
            invoices.findOpen.mockRejectedValue(failure)

            await expect(service.acceptBankTransfer(notice)).rejects.toBe(failure)

            expect(inbox.release).toHaveBeenCalledWith("sepay", "92704")
            expect(tx.rollbacks).toBe(1)
        })
    })
})
