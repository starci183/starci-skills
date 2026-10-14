import { fakeInbox, fakeTransaction, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { @@Provider@@DeliveryRecordedEvent } from "@modules/events/@@provider@@"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { INBOX } from "@modules/platform/inbox"
import { INSERT_@@providerUpper@@_INBOX } from "./persistence/@@provider@@-inbox.sql"
import { @@Provider@@InboxService } from "./@@provider@@-inbox.service"

const DELIVERY = { id: "delivery-1" }

const build = async (fresh: boolean, recorded: ReadonlyArray<{ readonly id: string }> = [{ id: "inbox-1" }]) => {
    const entityManager = mockEntityManager({ query: [INSERT_@@providerUpper@@_INBOX, recorded] })
    const transaction = fakeTransaction(entityManager)
    const claims = fakeInbox()
    if (!fresh) claims.seen("webhook.@@provider@@", "delivery-1")
    const events = recordingEventBus<@@Provider@@DeliveryRecordedEvent>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            @@Provider@@InboxService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: INBOX, useValue: claims },
            { provide: EVENT_BUS, useValue: events },
        ],
    }).compile()
    return { inbox: moduleRef.get(@@Provider@@InboxService), claims, events, entityManager, transaction }
}

describe("@@Provider@@InboxService", () => {
    describe("record@@Provider@@Delivery", () => {
        it("claims, records and publishes a typed event in the same transaction", async () => {
            const { inbox, claims, events, entityManager, transaction } = await build(true)

            await inbox.record@@Provider@@Delivery({ eventId: "delivery-1", delivery: DELIVERY })

            expect(entityManager.query).toHaveBeenCalledTimes(1)
            expect(entityManager.query).toHaveBeenCalledWith(INSERT_@@providerUpper@@_INBOX, ["@@provider@@", "delivery-1", JSON.stringify(DELIVERY)])
            expect(claims.claims).toEqual([{ source: "webhook.@@provider@@", eventId: "delivery-1" }])
            expect(events.events).toEqual([@@Provider@@DeliveryRecordedEvent.create({ receiptId: "inbox-1" })])
            expect(events.allInTransaction).toBe(true)
            expect(events.entries[0]?.tx).not.toBe(entityManager)
            expect(transaction.commits).toBe(1)
        })

        it("acknowledges a duplicate @@provider@@ delivery without further work", async () => {
            const { inbox, events, entityManager, transaction } = await build(false)

            await inbox.record@@Provider@@Delivery({ eventId: "delivery-1", delivery: DELIVERY })

            expect(entityManager.query).not.toHaveBeenCalled()
            expect(events.events).toEqual([])
            expect(transaction.commits).toBe(1)
        })

        it("does not publish for an already recorded receipt", async () => {
            const { inbox, events, transaction } = await build(true, [])

            await inbox.record@@Provider@@Delivery({ eventId: "delivery-1", delivery: DELIVERY })

            expect(events.events).toEqual([])
            expect(transaction.commits).toBe(1)
        })

        it("rolls back the receipt when publishing fails", async () => {
            const { inbox, events, transaction } = await build(true)
            const failure = new Error("outbox unavailable")
            events.failNext("publish", failure)

            await expect(inbox.record@@Provider@@Delivery({ eventId: "delivery-1", delivery: DELIVERY })).rejects.toBe(failure)

            expect(transaction.rollbacks).toBe(1)
            expect(transaction.commits).toBe(0)
        })
    })
})
