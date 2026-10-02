import { Inject, Injectable } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import type { Logger } from "@modules/platform/logging"
import { OutboxLogEvent } from "./outbox.log-events"
import { OutboxRelayService } from "./outbox-relay.service"

interface Row {
    readonly id: string
}

const MANAGERS: unique symbol = Symbol("spec.managers")
const LOGGER: unique symbol = Symbol("spec.logger")
const WAITING: unique symbol = Symbol("spec.waiting")

@Injectable()
/** A relay over a fixed list of waiting rows that records what it delivered and marked. */
class ListRelay extends OutboxRelayService<Row> {
    readonly delivered: Array<string> = []
    readonly marked: Array<string> = []
    readonly outbox = "list"
    idles = 0
    deliverFails = false

    constructor(
        @Inject(MANAGERS) protected readonly managers: ReadonlyArray<EntityManager>,
        @Inject(LOGGER) protected readonly logger: Logger,
        @Inject(WAITING) private waiting: Array<Row>,
    ) {
        super()
    }

    protected select(): Promise<Array<Row>> {
        return Promise.resolve(this.waiting)
    }

    protected deliver(rows: ReadonlyArray<Row>): Promise<void> {
        if (this.deliverFails) return Promise.reject(new Error("broker down"))
        this.delivered.push(...rows.map((row) => row.id))
        return Promise.resolve()
    }

    protected mark(_tx: EntityManager, rows: ReadonlyArray<Row>): Promise<void> {
        this.marked.push(...rows.map((row) => row.id))
        this.waiting = []
        return Promise.resolve()
    }

    protected idle(): Promise<void> {
        this.idles += 1
        return Promise.resolve()
    }
}

const build = async (managers: ReadonlyArray<EntityManager>, waiting: Array<Row>) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ListRelay,
            { provide: MANAGERS, useValue: managers },
            { provide: LOGGER, useValue: logger },
            { provide: WAITING, useValue: waiting },
        ],
    }).compile()
    return { relay: moduleRef.get(ListRelay), logger }
}

describe("OutboxRelayService", () => {
    describe("relay", () => {
        it("delivers the waiting rows of every connection, marks them in the same transaction and answers how many it relayed", async () => {
            const first = fakeTransaction(mockEntityManager())
            const second = fakeTransaction(mockEntityManager())
            const { relay } = await build([first.em, second.em], [{ id: "a" }, { id: "b" }])

            await expect(relay.relay()).resolves.toBe(2)

            expect(relay.delivered).toEqual(["a", "b"])
            expect(relay.marked).toEqual(["a", "b"])
            expect(first.commits).toBe(1)
            expect(second.commits).toBe(1)
        })

        it("answers 0 and marks nothing when no row waits", async () => {
            const { relay } = await build([fakeTransaction(mockEntityManager()).em], [])

            await expect(relay.relay()).resolves.toBe(0)

            expect(relay.marked).toEqual([])
        })

        it("rolls the transaction back and marks nothing when the delivery fails", async () => {
            const connection = fakeTransaction(mockEntityManager())
            const { relay } = await build([connection.em], [{ id: "a" }])
            relay.deliverFails = true

            await expect(relay.relay()).rejects.toThrow("broker down")

            expect(relay.marked).toEqual([])
            expect(connection.rollbacks).toBe(1)
        })
    })

    describe("the loop", () => {
        it("logs a failed pass under the capability's event and stops at shutdown", async () => {
            const { relay, logger } = await build([fakeTransaction(mockEntityManager()).em], [{ id: "a" }])
            relay.deliverFails = true

            relay.onApplicationBootstrap()
            await Promise.resolve()
            await relay.onApplicationShutdown()

            expect(logger.error).toHaveBeenCalledWith(OutboxLogEvent.RelayFailed, expect.any(Error), {
                outbox: "list",
            })
            expect(relay.idles).toBeLessThanOrEqual(1)
        })
    })
})
