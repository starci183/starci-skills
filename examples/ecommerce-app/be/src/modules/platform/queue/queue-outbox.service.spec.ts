import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { QueueOutboxService } from "./queue-outbox.service"
import { INSERT_QUEUE_ROW } from "./persistence/queue.sql"

const AT = "2026-02-03T04:05:06.000Z"

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [QueueOutboxService, { provide: CLOCK, useValue: new FakeClock(AT) }],
    }).compile()
    return { outbox: moduleRef.get(QueueOutboxService) }
}

describe("QueueOutboxService", () => {
    describe("write", () => {
        it("writes the job as a row of the outbox of the transaction it is given", async () => {
            const { outbox } = await build()
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_QUEUE_ROW, []] }))

            await tx.em.transaction((manager) => outbox.write(manager, "mail", { id: "m-1" }))

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_QUEUE_ROW, [
                "mail",
                JSON.stringify({ id: "m-1" }),
                new Date(AT),
            ])
            expect(tx.commits).toBe(1)
        })

        it("leaves no row behind when the transaction rolls back", async () => {
            const { outbox } = await build()
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_QUEUE_ROW, []] }))
            const failure = new Error("the change failed")

            await expect(
                tx.em.transaction(async (manager) => {
                    await outbox.write(manager, "mail", { id: "m-1" })
                    throw failure
                }),
            ).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.committedWrites).toEqual([])
        })
    })
})
