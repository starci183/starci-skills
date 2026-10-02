import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import type { Logger } from "@modules/platform/logging"
import { OutboxLogEvent } from "./outbox.log-events"
import { OutboxRelayPolicy } from "./outbox-relay.policy"

interface Row {
    readonly id: string
}

class ProbeRelay extends OutboxRelayPolicy<Row> {
    readonly select = jest.fn<Promise<Array<Row>>, [EntityManager]>()
    readonly deliver = jest.fn<Promise<void>, [ReadonlyArray<Row>]>()
    readonly mark = jest.fn<Promise<void>, [EntityManager, ReadonlyArray<Row>]>()
    readonly idle = jest.fn<Promise<void>, []>()

    constructor(
        protected readonly managers: ReadonlyArray<EntityManager>,
        protected readonly logger: Logger,
        protected readonly outbox = "probe",
    ) {
        super()
    }
}

const build = (...managers: Array<MockEntityManager>) => {
    const logger = mock<Logger>()
    const relay = new ProbeRelay(managers, logger)
    return { relay, logger }
}

describe("OutboxRelayPolicy", () => {
    describe("relay", () => {
        it("delivers and marks every connection's waiting rows in its own transaction", async () => {
            const first = fakeTransaction(mockEntityManager())
            const second = fakeTransaction(mockEntityManager())
            const { relay } = build(first.em, second.em)
            const rows = [{ id: "row-1" }, { id: "row-2" }]
            relay.select.mockResolvedValueOnce(rows).mockResolvedValueOnce([])
            relay.deliver.mockResolvedValue(undefined)
            relay.mark.mockResolvedValue(undefined)

            await expect(relay.relay()).resolves.toBe(2)

            expect(relay.deliver).toHaveBeenCalledWith(rows)
            expect(relay.mark).toHaveBeenCalledWith(expect.any(Object), rows)
            expect(relay.mark).toHaveBeenCalledTimes(1)
            expect(first.commits).toBe(1)
            expect(second.commits).toBe(1)
        })

        it("leaves the rows unmarked when delivery fails", async () => {
            const transaction = fakeTransaction(mockEntityManager())
            const { relay } = build(transaction.em)
            const failure = new Error("transport down")
            relay.select.mockResolvedValue([{ id: "row-1" }])
            relay.deliver.mockRejectedValue(failure)

            await expect(relay.relay()).rejects.toBe(failure)

            expect(relay.mark).not.toHaveBeenCalled()
            expect(transaction.rollbacks).toBe(1)
        })
    })

    describe("the loop", () => {
        it("repeats immediately after work, idles after an empty or failed pass, logs the failure and stops on shutdown", async () => {
            const { relay, logger } = build()
            const failure = new Error("outbox unreadable")
            jest.spyOn(relay, "relay").mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockRejectedValueOnce(failure)
            let waits = 0
            let shutdown: Promise<void> = Promise.resolve()
            let reachedShutdown: () => void = () => undefined
            const stopped = new Promise<void>((resolve) => {
                reachedShutdown = resolve
            })
            relay.idle.mockImplementation(() => {
                waits += 1
                if (waits === 2) {
                    shutdown = relay.onApplicationShutdown()
                    reachedShutdown()
                }
                return Promise.resolve()
            })

            relay.onApplicationBootstrap()
            await stopped
            await shutdown

            expect(relay.relay).toHaveBeenCalledTimes(3)
            expect(relay.idle).toHaveBeenCalledTimes(2)
            expect(logger.error).toHaveBeenCalledWith(OutboxLogEvent.RelayFailed, failure, { outbox: "probe" })
        })
    })
})
