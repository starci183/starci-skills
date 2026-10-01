import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, recordingOutbox } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OUTBOX } from "@modules/platform/outbox"
import { outboxRecord, PLATFORM_AT } from "@tests/fixtures/builders/platform.builder"
import { MessagingError, MessagingErrorCode } from "./errors/messaging.error"
import { MessageRunnerService } from "./message-runner.service"
import type { ConsumedMessage, QueueDefinition } from "./messaging.contracts"
import { MessagingLogEvent } from "./messaging.log-events"
import type { MessagingOptions } from "./messaging.options"
import type { MessageConsumer } from "./messaging.port"
import { MESSAGING_OPTIONS } from "./messaging.decorators"

const options = builder<MessagingOptions>({ pollMs: 500, batchSize: 10, visibilityMs: 30_000 })()

const queue: QueueDefinition<object> = {
    name: "audit.append",
    attempts: 3,
    backoffMs: 1000,
    parse: (value) => (typeof value === "object" ? value : null),
}

const consumerOf = (handle: MessageConsumer<object>["handle"] = () => Promise.resolve()): MessageConsumer<object> => ({
    queue,
    handle: jest.fn(handle),
})

const build = async () => {
    const clock = new FakeClock(PLATFORM_AT)
    const outbox = recordingOutbox()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MessageRunnerService,
            { provide: MESSAGING_OPTIONS, useValue: options },
            { provide: OUTBOX, useValue: outbox },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { runner: moduleRef.get(MessageRunnerService), clock, outbox, logger }
}

describe("MessageRunnerService", () => {
    afterEach(() => {
        jest.useRealTimers()
    })

    describe("drain", () => {
        it("claims the due messages of the registered queues with the options and the instant of the clock", async () => {
            const { runner, outbox } = await build()
            runner.add(consumerOf())

            await runner.drain()

            expect(outbox.claims).toEqual([
                { at: new Date(PLATFORM_AT), queues: ["audit.append"], limit: 10, visibilityMs: 30_000 },
            ])
        })

        it("hands the parsed message to its consumer and completes it", async () => {
            const { runner, outbox } = await build()
            const consumer = consumerOf()
            const expected: ConsumedMessage<object> = { id: "m-1", eventId: "e-1", payload: { a: 1 }, attempt: 2 }
            outbox.queueRecords(outboxRecord({ attempts: 2 }))
            runner.add(consumer)

            await runner.drain()

            expect(consumer.handle).toHaveBeenCalledWith(expected)
            expect(outbox.completed).toEqual(["m-1"])
            expect(outbox.retried).toEqual([])
            expect(outbox.buried).toEqual([])
        })

        it("leaves a claimed message of a queue without a consumer alone", async () => {
            const { runner, outbox } = await build()
            // The recording outbox claims only the registered queues, so a claim that hands out a message of a queue no consumer
            // registered is scripted here.
            jest.spyOn(outbox, "claimDue").mockResolvedValueOnce([outboxRecord({ queue: "other.queue" })])
            runner.add(consumerOf())

            await runner.drain()

            expect(outbox.completed).toEqual([])
            expect(outbox.retried).toEqual([])
            expect(outbox.buried).toEqual([])
        })

        it("reschedules a failed delivery with a doubling backoff and logs the retry", async () => {
            const { runner, outbox, logger } = await build()
            outbox.queueRecords(outboxRecord({ attempts: 2 }))
            runner.add(consumerOf(() => Promise.reject(new TypeError("boom"))))

            await runner.drain()

            expect(outbox.retried).toEqual([
                { id: "m-1", at: new Date("2026-05-01T10:00:02.000Z"), error: "TypeError: boom" },
            ])
            expect(logger.warn).toHaveBeenCalledWith(MessagingLogEvent.DeliveryRetried, {
                queue: "audit.append",
                attempt: 2,
                failure: "TypeError: boom",
            })
            expect(outbox.completed).toEqual([])
        })

        it("buries a delivery that ran out of attempts and logs it", async () => {
            const { runner, outbox, logger } = await build()
            const failure = new Error("boom")
            outbox.queueRecords(outboxRecord({ attempts: 3 }))
            runner.add(consumerOf(() => Promise.reject(failure)))

            await runner.drain()

            expect(outbox.buried).toEqual([{ id: "m-1", error: "Error: boom" }])
            expect(logger.error).toHaveBeenCalledWith(MessagingLogEvent.DeliveryBuried, failure, {
                queue: "audit.append",
                attempts: 3,
            })
            expect(outbox.retried).toEqual([])
        })

        it("describes a failure that is not an Error by its text", async () => {
            const { runner, outbox } = await build()
            outbox.queueRecords(outboxRecord({ attempts: 3 }))
            runner.add(consumerOf(() => Promise.reject("plain failure")))

            await runner.drain()

            expect(outbox.buried).toEqual([{ id: "m-1", error: "plain failure" }])
        })

        it("fails a delivery whose payload does not parse without calling the consumer", async () => {
            const { runner, outbox, logger } = await build()
            const consumer = consumerOf()
            outbox.queueRecords(outboxRecord({ payload: null, attempts: 3 }))
            runner.add(consumer)

            await runner.drain()

            expect(consumer.handle).not.toHaveBeenCalled()
            expect(outbox.buried).toEqual([
                { id: "m-1", error: `MessagingError: ${MessagingErrorCode.PayloadInvalid}` },
            ])
            expect(logger.error).toHaveBeenCalledWith(
                MessagingLogEvent.DeliveryBuried,
                expect.any(MessagingError),
                expect.anything(),
            )
        })

        it("delivers every claimed message in order", async () => {
            const { runner, outbox } = await build()
            const consumer = consumerOf()
            outbox.queueRecords(
                outboxRecord({ id: "m-1", eventId: "e-1" }),
                outboxRecord({ id: "m-2", eventId: "e-2" }),
            )
            runner.add(consumer)

            await runner.drain()

            expect(outbox.completed).toEqual(["m-1", "m-2"])
        })
    })

    describe("lifecycle", () => {
        it("never polls when no consumer is registered", async () => {
            jest.useFakeTimers()
            const { runner } = await build()

            runner.onApplicationBootstrap()

            expect(jest.getTimerCount()).toBe(0)
        })

        it("polls every poll interval while consumers are registered", async () => {
            jest.useFakeTimers()
            const { runner, outbox } = await build()
            runner.add(consumerOf())

            runner.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(1000)

            expect(outbox.claims).toHaveLength(2)
        })

        it("logs a failed poll and keeps polling", async () => {
            jest.useFakeTimers()
            const { runner, outbox, logger } = await build()
            const failure = new Error("store down")
            outbox.failNext("claimDue", failure)
            runner.add(consumerOf())

            runner.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(1000)

            expect(logger.error).toHaveBeenCalledWith(MessagingLogEvent.PollFailed, failure)
            expect(outbox.claims).toHaveLength(2)
        })

        it("stops polling on shutdown", async () => {
            jest.useFakeTimers()
            const { runner } = await build()
            runner.add(consumerOf())
            runner.onApplicationBootstrap()

            runner.onApplicationShutdown()

            expect(jest.getTimerCount()).toBe(0)
        })

        it("does not schedule another poll when shutdown arrives while a poll runs", async () => {
            jest.useFakeTimers()
            const { runner, outbox } = await build()
            outbox.queueRecords(outboxRecord())
            runner.add(
                consumerOf(() => {
                    runner.onApplicationShutdown()
                    return Promise.resolve()
                }),
            )

            runner.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(500)

            expect(jest.getTimerCount()).toBe(0)
        })

        it("shuts down cleanly when it never started", async () => {
            const { runner } = await build()

            expect(runner.onApplicationShutdown()).toBeUndefined()
        })
    })
})
