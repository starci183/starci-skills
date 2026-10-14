import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INSERT_@@providerUpper@@_INBOX } from "./persistence/@@provider@@-inbox.sql"
import { @@Provider@@InboxService } from "./@@provider@@-inbox.service"

const DELIVERY = { id: "delivery-1" }

const build = async (recorded: ReadonlyArray<{ readonly id: string }>) => {
    const entityManager = mockEntityManager({ query: [INSERT_@@providerUpper@@_INBOX, recorded] })
    const transaction = fakeTransaction(entityManager)
    const moduleRef = await Test.createTestingModule({
        providers: [
            @@Provider@@InboxService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
        ],
    }).compile()
    return { inbox: moduleRef.get(@@Provider@@InboxService), entityManager, transaction }
}

describe("@@Provider@@InboxService", () => {
    describe("record@@Provider@@Delivery", () => {
        it("records a pending @@provider@@ delivery without business processing or a completion write", async () => {
            const { inbox, entityManager, transaction } = await build([{ id: "inbox-1" }])

            await inbox.record@@Provider@@Delivery("delivery-1", DELIVERY)

            expect(entityManager.query).toHaveBeenCalledTimes(1)
            expect(entityManager.query).toHaveBeenCalledWith(INSERT_@@providerUpper@@_INBOX, ["@@provider@@", "delivery-1", JSON.stringify(DELIVERY)])
            expect(transaction.commits).toBe(1)
        })

        it("acknowledges a duplicate @@provider@@ delivery without further work", async () => {
            const { inbox, entityManager, transaction } = await build([])

            await inbox.record@@Provider@@Delivery("delivery-1", DELIVERY)

            expect(entityManager.query).toHaveBeenCalledTimes(1)
            expect(transaction.commits).toBe(1)
        })
    })
})
