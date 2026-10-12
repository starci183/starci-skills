import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { @@service@@ } from "@@serviceModule@@"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { COMPLETE_@@providerUpper@@_INBOX, INSERT_@@providerUpper@@_INBOX } from "./persistence/@@provider@@-inbox.sql"
import { @@Provider@@InboxService } from "./@@provider@@-inbox.service"

const DELIVERY = { id: "delivery-1" }

const build = async (claimed: ReadonlyArray<{ readonly id: string }>) => {
    const entityManager = mockEntityManager({
        query: [[INSERT_@@providerUpper@@_INBOX, claimed], [COMPLETE_@@providerUpper@@_INBOX, claimed]],
    })
    const transaction = fakeTransaction(entityManager)
    const deliveries = mock<@@service@@>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            @@Provider@@InboxService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: @@service@@, useValue: deliveries },
        ],
    }).compile()
    return { inbox: moduleRef.get(@@Provider@@InboxService), deliveries, transaction }
}

describe("@@Provider@@InboxService", () => {
    describe("accept@@Provider@@Delivery", () => {
        it("claims a new @@provider@@ delivery and runs the domain intake inside the claiming transaction", async () => {
            const { inbox, deliveries, transaction } = await build([{ id: "inbox-1" }])

            await inbox.accept@@Provider@@Delivery("delivery-1", DELIVERY)

            expect(deliveries.accept@@Provider@@Delivery).toHaveBeenCalledTimes(1)
            expect(deliveries.accept@@Provider@@Delivery).toHaveBeenCalledWith(DELIVERY, expect.anything())
            expect(transaction.commits).toBe(1)
        })

        it("acknowledges a duplicate @@provider@@ delivery without running the domain intake again", async () => {
            const { inbox, deliveries } = await build([])

            await inbox.accept@@Provider@@Delivery("delivery-1", DELIVERY)

            expect(deliveries.accept@@Provider@@Delivery).not.toHaveBeenCalled()
        })
    })
})
