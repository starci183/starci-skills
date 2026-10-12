import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { QUEUE_TRANSPORT } from "./queue.decorators"
import { QueueOutboxService } from "./queue-outbox.service"
import type { QueueTransport } from "./queue-transport.port"
import { INSERT_QUEUE_ROW } from "./persistence/queue.sql"

const AT = "2026-02-03T04:05:06.000Z"

const ROW = { id: "row-1", queue: "mail", payload: { id: "m-1" } }

const build = async () => {
    const transport = mock<QueueTransport>()
    transport.add.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            QueueOutboxService,
            { provide: QUEUE_TRANSPORT, useValue: transport },
            { provide: CLOCK, useValue: new FakeClock(AT) },
        ],
    }).compile()
    return { outbox: moduleRef.get(QueueOutboxService), transport }
}

describe("QueueOutboxService", () => {
    describe("write", () => {
        it("writes the job row and sends its pgmq message, both in the transaction it is given", async () => {
            const { outbox, transport } = await build()
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_QUEUE_ROW, [ROW]] }))

            await tx.em.transaction((manager) => outbox.write(manager, "mail", { id: "m-1" }))

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_QUEUE_ROW, [
                "mail",
                JSON.stringify({ id: "m-1" }),
                new Date(AT),
            ])
            expect(transport.add).toHaveBeenCalledWith(expect.any(Object), "mail", "row-1", { id: "m-1" })
            expect(tx.commits).toBe(1)
        })

        it("leaves no row and no message behind when the transaction rolls back", async () => {
            const { outbox } = await build()
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_QUEUE_ROW, [ROW]] }))
            const failure = new Error("the change failed")

            await expect(
                tx.em.transaction(async (manager) => {
                    await outbox.write(manager, "mail", { id: "m-1" })
                    return Promise.reject(failure)
                }),
            ).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.committedWrites).toEqual([])
        })

        it("rolls the change back when pgmq refuses the message", async () => {
            const { outbox, transport } = await build()
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_QUEUE_ROW, [ROW]] }))
            const failure = new Error("queue missing")
            transport.add.mockRejectedValue(failure)

            await expect(tx.em.transaction((manager) => outbox.write(manager, "mail", { id: "m-1" }))).rejects.toBe(
                failure,
            )

            expect(tx.rollbacks).toBe(1)
        })
    })
})
