import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import type { Logger } from "@modules/platform/logging"
import type { Outbox, OutboxRecord } from "@modules/platform/outbox"
import { MessageRunner } from "./message-runner.service"
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

const build = (claimed: ReadonlyArray<OutboxRecord>, handle: jest.Mock): { runner: MessageRunner; outbox: Outbox; logger: Logger } => {
    const outbox = mock<Outbox>({ claimDue: jest.fn().mockResolvedValue(claimed) })
    const logger = mock<Logger>()
    const runner = new MessageRunner(OPTIONS, outbox, new FakeClock(AT), logger)
    runner.add({ queue: QUEUE, handle })
    return { runner, outbox, logger }
}

describe("MessageRunner", () => {
    it("claims only the registered queues and completes a handled message", async () => {
        const handle = jest.fn().mockResolvedValue(undefined)
        const { runner, outbox } = build([record(1)], handle)
        await runner.drain()
        expect(outbox.claimDue).toHaveBeenCalledWith({ at: AT, queues: [QUEUE.name], limit: 10, visibilityMs: 60_000 })
        expect(handle).toHaveBeenCalledWith({ id: "m1", eventId: "e1", payload: { n: 1 }, attempt: 1 })
        expect(outbox.complete).toHaveBeenCalledWith("m1")
    })

    it("reschedules a failed message with the doubled backoff", async () => {
        const handle = jest.fn().mockRejectedValue(new TypeError("boom"))
        const { runner, outbox, logger } = build([record(2)], handle)
        await runner.drain()
        expect(outbox.retry).toHaveBeenCalledWith({
            id: "m1",
            at: new Date(AT.getTime() + 2_000),
            error: "TypeError: boom",
        })
        expect(outbox.complete).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(MessagingLogEvent.DeliveryRetried, expect.any(Object))
    })

    it("buries a message that used its last attempt", async () => {
        const handle = jest.fn().mockRejectedValue(new TypeError("boom"))
        const { runner, outbox, logger } = build([record(3)], handle)
        await runner.drain()
        expect(outbox.bury).toHaveBeenCalledWith({ id: "m1", error: "TypeError: boom" })
        expect(logger.error).toHaveBeenCalledWith(MessagingLogEvent.DeliveryBuried, expect.any(TypeError), {
            queue: QUEUE.name,
            attempts: 3,
        })
    })

    it("treats a payload of the wrong shape as a failed delivery, never as a handled one", async () => {
        const handle = jest.fn()
        const { runner, outbox } = build([record(1, { n: "x" })], handle)
        await runner.drain()
        expect(handle).not.toHaveBeenCalled()
        expect(outbox.retry).toHaveBeenCalled()
    })
})
