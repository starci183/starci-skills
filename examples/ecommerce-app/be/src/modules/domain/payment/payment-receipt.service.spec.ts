import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { BankTransferReceivedEvent } from "@modules/events/billing"
import { BILLING_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { INBOX } from "@modules/platform/inbox"
import { PaymentReceiptService } from "./payment-receipt.service"

const notice = {
    eventId: "92704",
    code: "o-1",
    transferType: "in" as const,
    transferAmount: 1500,
    referenceCode: "FT92704",
}

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const inbox = fakeInbox()
    const claim = jest.spyOn(inbox, "claim")
    const release = jest.spyOn(inbox, "release")
    const bus = recordingEventBus()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentReceiptService,
            { provide: BILLING_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
            { provide: EVENT_BUS, useValue: bus },
        ],
    }).compile()
    return { service: moduleRef.get(PaymentReceiptService), tx, inbox, claim, release, bus }
}

describe("PaymentReceiptService", () => {
    it("commits only the receipt and typed event using the same manager, and ignores redelivery", async () => {
        const { service, tx, claim, bus } = await build()
        await service.recordBankTransfer(notice)
        expect(bus.writes).toEqual([BankTransferReceivedEvent.create(notice)])
        expect(BankTransferReceivedEvent.parse({ eventId: notice.eventId, payload: bus.writes[0]?.payload })).toEqual(
            bus.writes[0],
        )
        expect(bus.allInTransaction).toBe(true)
        expect(claim).toHaveBeenCalledWith("sepay", notice.eventId, bus.entries[0]?.tx)
        expect(bus.entries[0]?.tx).not.toBe(tx.em)
        expect(tx.em.save).not.toHaveBeenCalled()
        expect(tx.commits).toBe(1)
        await service.recordBankTransfer(notice)
        expect(bus.writes).toHaveLength(1)
        expect(tx.commits).toBe(2)
    })

    it("rolls back failed publication and keeps the same delivery retryable without deleting claims", async () => {
        const { service, tx, inbox, bus, release } = await build()
        const failure = new Error("outbox unavailable")
        bus.failNext("publish", failure)
        await expect(service.recordBankTransfer(notice)).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
        expect(tx.committedWrites).toEqual([])
        expect(bus.writes).toEqual([])
        expect(release).not.toHaveBeenCalled()
        // The shared inbox fake is not transactional; model the database rollback before retry.
        inbox.clear()
        await service.recordBankTransfer(notice)
        expect(bus.writes).toEqual([BankTransferReceivedEvent.create(notice)])
        expect(tx.commits).toBe(1)
    })

    it("propagates a failed inbox claim before publication", async () => {
        const { service, tx, inbox, bus, release } = await build()
        const failure = new Error("inbox unavailable")
        inbox.failNext("claim", failure)
        await expect(service.recordBankTransfer(notice)).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
        expect(bus.writes).toEqual([])
        expect(release).not.toHaveBeenCalled()
    })
})
