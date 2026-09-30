import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import type { Logger } from "@modules/platform/logging"
import type { Outbox, OutboxRecord } from "@modules/platform/outbox"
import { MessageRunnerService } from "./message-runner.service"
import { MessagingLogEvent } from "./messaging.log-events"
import type { MessagingOptions } from "./messaging.options"
import { defineQueue } from "./queue.policy"

interface Ping {
    readonly n: number
}

const AT = new Date("2026-09-30T10:00:00.000Z")
const OPTIONS: MessagingOptions = { pollMs: 1_000, batchSize: 10, visibilityMs: 60_000 }
const QUEUE = defineQueue<Ping>({
    name: "test.ping",
    attempts: 3,
    backoffMs: 1_000,
    parse: (value) =>
        typeof value === "object" && value !== null && "n" in value && typeof value.n === "number"
            ? { n: value.n }
            : null,
})

const record = (attempts: number, payload: unknown = { n: 1 }): OutboxRecord => ({
    id: "m1",
    queue: QUEUE.name,
    eventId: "e1",
    payload,
    attempts,
})

interface Retry {
    readonly id: string
    readonly at: Date
    readonly error: string
}

interface Burial {
    readonly id: string
    readonly error: string
}

interface Claim {
    readonly at: Date
    readonly queues: ReadonlyArray<string>
    readonly limit: number
    readonly visibilityMs: number
}

interface Ledger {
    readonly completed: Array<string>
    readonly retried: Array<Retry>
    readonly buried: Array<Burial>
    readonly claims: Array<Claim>
}

interface Rig {
    readonly runner: MessageRunnerService
    readonly ledger: Ledger
    readonly logger: Logger
}

const build = (claimed: ReadonlyArray<OutboxRecord>, handle: jest.Mock): Rig => {
    const ledger: Ledger = { completed: [], retried: [], buried: [], claims: [] }
    const outbox = mock<Outbox>({
        claimDue: jest.fn().mockImplementation((params: Claim) => {
            ledger.claims.push(params)
            return Promise.resolve(claimed)
        }),
        complete: jest.fn().mockImplementation((id: string) => {
            ledger.completed.push(id)
            return Promise.resolve()
        }),
        retry: jest.fn().mockImplementation((params: Retry) => {
            ledger.retried.push(params)
            return Promise.resolve()
        }),
        bury: jest.fn().mockImplementation((params: Burial) => {
            ledger.buried.push(params)
            return Promise.resolve()
        }),
    })
    const logger = mock<Logger>()
    const runner = new MessageRunnerService(OPTIONS, outbox, new FakeClock(AT), logger)
    runner.add({ queue: QUEUE, handle })
    return { runner, ledger, logger }
}

describe("MessageRunnerService", () => {
    it("claims only the registered queues and completes a handled message", async () => {
        const handled: Array<unknown> = []
        const handle = jest.fn().mockImplementation((message: unknown) => {
            handled.push(message)
            return Promise.resolve()
        })
        const { runner, ledger } = build([record(1)], handle)
        await runner.drain()
        expect(ledger.claims).toEqual([{ at: AT, queues: [QUEUE.name], limit: 10, visibilityMs: 60_000 }])
        expect(handled).toEqual([{ id: "m1", eventId: "e1", payload: { n: 1 }, attempt: 1 }])
        expect(ledger.completed).toEqual(["m1"])
    })

    it("reschedules a failed message with the doubled backoff", async () => {
        const handle = jest.fn().mockRejectedValue(new TypeError("boom"))
        const { runner, ledger } = build([record(2)], handle)
        await runner.drain()
        expect(ledger.retried).toEqual([{ id: "m1", at: new Date(AT.getTime() + 2_000), error: "TypeError: boom" }])
        expect(ledger.completed).toEqual([])
        expect(ledger.buried).toEqual([])
    })

    it("buries a message that used its last attempt", async () => {
        const handle = jest.fn().mockRejectedValue(new TypeError("boom"))
        const { runner, ledger, logger } = build([record(3)], handle)
        await runner.drain()
        expect(ledger.buried).toEqual([{ id: "m1", error: "TypeError: boom" }])
        expect(ledger.retried).toEqual([])
        expect(logger.error).toHaveBeenCalledWith(MessagingLogEvent.DeliveryBuried, expect.any(TypeError), {
            queue: QUEUE.name,
            attempts: 3,
        })
    })

    it("treats a payload of the wrong shape as a failed delivery, never as a handled one", async () => {
        const handle = jest.fn()
        const { runner, ledger } = build([record(1, { n: "x" })], handle)
        await runner.drain()
        expect(handle.mock.calls).toHaveLength(0)
        expect(ledger.retried).toHaveLength(1)
        expect(ledger.completed).toEqual([])
    })
})
