import { Test } from "@nestjs/testing"
import { FakeClock, fakeInbox, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { LoyaltyService } from "./loyalty.service"
import { LoyaltyEntryEntity } from "./persistence/entities/loyalty-entry.entity"
import { SUM_PERSON_POINTS } from "./persistence/loyalty.sql"

const AT = "2026-02-03T04:05:06.000Z"

const grant = { eventId: "o-1", orderId: "o-1", personId: "p-1", totalMinorUnits: 1250 }

const entry = (points: number): LoyaltyEntryEntity => ({
    id: "l-1",
    personId: "p-1",
    orderId: "o-1",
    points,
    createdAt: new Date(AT),
})

const build = async (entityManager: MockEntityManager, claimed = true) => {
    const inbox = fakeInbox()
    if (!claimed) inbox.seen("order-paid-loyalty", "o-1")
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyService,
            { provide: ORDER_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: INBOX, useValue: inbox },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyService), inbox }
}

describe("LoyaltyService", () => {
    describe("grantForOrder", () => {
        it("claims the event first, then records floor(total / 100) points for the order, stamped by the clock", async () => {
            const manager = mockEntityManager({ save: [LoyaltyEntryEntity, entry(12)] })
            const { service, inbox } = await build(manager)

            await service.grantForOrder(grant)

            expect(inbox.claims).toEqual([{ source: "order-paid-loyalty", eventId: "o-1" }])
            expect(manager.save).toHaveBeenCalledWith(LoyaltyEntryEntity, {
                personId: "p-1",
                orderId: "o-1",
                points: 12,
                createdAt: new Date(AT),
            })
        })

        it("writes nothing for a redelivered event", async () => {
            const manager = mockEntityManager()
            const { service } = await build(manager, false)

            await service.grantForOrder(grant)

            expect(manager.save).not.toHaveBeenCalled()
        })

        it("writes nothing for an order that earns no point", async () => {
            const manager = mockEntityManager()
            const { service } = await build(manager)

            await service.grantForOrder({ ...grant, totalMinorUnits: 99 })

            expect(manager.save).not.toHaveBeenCalled()
        })

        it("gives the claim back and rethrows when the entry cannot be written, so the redelivery grants it", async () => {
            const failure = new Error("order database down")
            const manager = mockEntityManager({ save: [LoyaltyEntryEntity, entry(12)] })
            manager.save.mockRejectedValueOnce(failure)
            const { service, inbox } = await build(manager)

            await expect(service.grantForOrder(grant)).rejects.toBe(failure)

            expect(inbox.released).toEqual([{ source: "order-paid-loyalty", eventId: "o-1" }])
        })
    })

    describe("pointsOf", () => {
        it("answers the points the ledger sums for the buyer, and zero when it has no entry", async () => {
            const manager = mockEntityManager({ query: [SUM_PERSON_POINTS, [{ points: 17 }]] })
            const { service } = await build(manager)

            expect(await service.pointsOf("p-1")).toBe(17)
            expect(manager.query).toHaveBeenCalledWith(SUM_PERSON_POINTS, ["p-1"])
        })
    })
})
