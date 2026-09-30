import { Test } from "@nestjs/testing"
import { builder, FakeClock, fakeLock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LEASE } from "@modules/platform/lease"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SchedulingError, SchedulingErrorCode } from "./errors/scheduling.error"
import { JobRunner } from "./job-runner.service"
import { SchedulingLogEvent } from "./scheduling.log-events"
import type { SchedulingOptions } from "./scheduling.options"
import type { ScheduledJob } from "./scheduling.port"
import { SCHEDULING_OPTIONS } from "./scheduling.decorators"

const AT = "2026-05-01T10:00:00.000Z"
const options = builder<SchedulingOptions>({ tickMs: 1000 })

const build = async () => {
    const clock = new FakeClock(AT)
    const lease = fakeLock(clock)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobRunner,
            { provide: SCHEDULING_OPTIONS, useValue: options() },
            { provide: LEASE, useValue: lease },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { runner: moduleRef.get(JobRunner), clock, lease, logger }
}

const jobOf = (name: string, schedule: ScheduledJob["schedule"], run: ScheduledJob["run"] = () => Promise.resolve()): ScheduledJob => ({
    name,
    schedule,
    run: jest.fn(run),
})

const gate = () => {
    let open: () => void = () => undefined
    const promise = new Promise<void>((resolve) => {
        open = () => resolve()
    })
    return { promise, open: () => open() }
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

describe("JobRunner", () => {
    afterEach(() => {
        jest.useRealTimers()
    })

    describe("add", () => {
        it("refuses a cron expression that does not parse, naming the job", async () => {
            const { runner } = await build()

            const failure = (() => {
                try {
                    runner.add(jobOf("digest", { cron: "not a cron" }))
                    return null
                } catch (error) {
                    return error
                }
            })()

            expect(failure).toBeInstanceOf(SchedulingError)
            expect(failure).toMatchObject({ code: SchedulingErrorCode.CronInvalid, params: { job: "digest" } })
        })
    })

    describe("tick", () => {
        it("runs a cron job in the minute its expression admits, once per minute", async () => {
            const { runner } = await build()
            const job = jobOf("digest", { cron: "0 10 * * *" })
            runner.add(job)

            await runner.tick(new Date(AT))
            await runner.tick(new Date("2026-05-01T10:00:30.000Z"))

            expect(job.run).toHaveBeenCalledTimes(1)
            expect(job.run).toHaveBeenCalledWith(new Date(AT))
        })

        it("skips a cron job in a minute its expression does not admit", async () => {
            const { runner } = await build()
            const job = jobOf("digest", { cron: "5 10 * * *" })
            runner.add(job)

            await runner.tick(new Date(AT))

            expect(job.run).not.toHaveBeenCalled()
        })

        it("runs an interval job at the first tick and again once the interval passed", async () => {
            const { runner } = await build()
            const job = jobOf("purge", { everyMs: 60_000 })
            runner.add(job)

            await runner.tick(new Date(AT))
            await runner.tick(new Date("2026-05-01T10:00:59.999Z"))
            expect(job.run).toHaveBeenCalledTimes(1)

            await runner.tick(new Date("2026-05-01T10:01:00.000Z"))
            expect(job.run).toHaveBeenCalledTimes(2)
        })

        it("does not run a job whose lease another replica holds", async () => {
            const { runner, lease, logger } = await build()
            const job = jobOf("purge", { everyMs: 60_000 })
            runner.add(job)
            await lease.acquire({ name: "purge", holder: "other-replica", ttlMs: 60_000 })

            await runner.tick(new Date(AT))

            expect(job.run).not.toHaveBeenCalled()
            expect(logger.info).not.toHaveBeenCalled()
        })

        it("takes the lease for the run and logs the completed job with its fence and duration", async () => {
            const { runner, clock, lease, logger } = await build()
            runner.add(
                jobOf("purge", { everyMs: 60_000 }, () => {
                    clock.advance(5)
                    return Promise.resolve()
                }),
            )

            await runner.tick(new Date(AT))

            expect(lease.isHeld("purge")).toBe(true)
            expect(lease.fenceOf("purge")).toBe(1)
            expect(logger.info).toHaveBeenCalledWith(SchedulingLogEvent.JobCompleted, { job: "purge", fence: 1, durationMs: 5 })
        })

        it("logs a failed job, releases its lease and runs it again at the next due tick", async () => {
            const { runner, lease, logger } = await build()
            const failure = new Error("boom")
            const job = jobOf("purge", { everyMs: 1000 }, () => Promise.reject(failure))
            runner.add(job)

            await runner.tick(new Date(AT))

            expect(logger.error).toHaveBeenCalledWith(SchedulingLogEvent.JobFailed, failure, { job: "purge", fence: 1 })
            expect(lease.isHeld("purge")).toBe(false)

            await runner.tick(new Date("2026-05-01T10:00:01.000Z"))
            expect(job.run).toHaveBeenCalledTimes(2)
        })

        it("never overlaps a job with itself in this process", async () => {
            const { runner } = await build()
            const running = gate()
            const job = jobOf("purge", { everyMs: 1000 }, () => running.promise)
            runner.add(job)

            const first = runner.tick(new Date(AT))
            await flush()
            await runner.tick(new Date("2026-05-01T10:00:02.000Z"))
            running.open()
            await first

            expect(job.run).toHaveBeenCalledTimes(1)
        })
    })

    describe("lifecycle", () => {
        it("never ticks when no job is registered", async () => {
            jest.useFakeTimers()
            const { runner } = await build()

            runner.onApplicationBootstrap()

            expect(jest.getTimerCount()).toBe(0)
        })

        it("ticks every tick interval with the instant of the clock while jobs are registered", async () => {
            jest.useFakeTimers()
            const { runner, clock } = await build()
            const job = jobOf("purge", { everyMs: 1000 })
            runner.add(job)

            runner.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(1000)
            clock.advance(1000)
            await jest.advanceTimersByTimeAsync(1000)

            expect(job.run).toHaveBeenCalledTimes(2)
            expect(job.run).toHaveBeenLastCalledWith(new Date("2026-05-01T10:00:01.000Z"))
        })

        it("stops ticking on shutdown", async () => {
            jest.useFakeTimers()
            const { runner } = await build()
            runner.add(jobOf("purge", { everyMs: 1000 }))
            runner.onApplicationBootstrap()

            runner.onApplicationShutdown()

            expect(jest.getTimerCount()).toBe(0)
        })

        it("does not schedule another tick when shutdown arrives while a tick runs", async () => {
            jest.useFakeTimers()
            const { runner } = await build()
            const running = gate()
            runner.add(jobOf("purge", { everyMs: 1000 }, () => running.promise))
            runner.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(1000)

            runner.onApplicationShutdown()
            running.open()
            await jest.advanceTimersByTimeAsync(0)

            expect(jest.getTimerCount()).toBe(0)
        })

        it("shuts down cleanly when it never started", async () => {
            const { runner } = await build()

            expect(runner.onApplicationShutdown()).toBeUndefined()
        })
    })
})
