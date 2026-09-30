import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import type { Lease } from "@modules/platform/lease"
import type { Logger } from "@modules/platform/logging"
import { SchedulingError } from "./errors/scheduling.error"
import { JobRunnerService } from "./job-runner.service"
import { SchedulingLogEvent } from "./scheduling.log-events"
import type { ScheduledJob } from "./scheduling.port"

const AT = new Date("2026-09-30T10:05:00.000Z")

interface Rig {
    readonly runner: JobRunnerService
    readonly lease: Lease
    readonly logger: Logger
}

const build = (grant: boolean): Rig => {
    const lease = mock<Lease>({
        acquire: jest.fn().mockResolvedValue(grant ? { name: "job", holder: "h", fence: 7 } : null),
    })
    const logger = mock<Logger>()
    return { runner: new JobRunnerService({ tickMs: 1_000 }, lease, new FakeClock(AT), logger), lease, logger }
}

const cronJob = (run: jest.Mock): ScheduledJob => ({ name: "job", schedule: { cron: "*/5 * * * *" }, run })

describe("JobRunnerService", () => {
    it("runs a cron job on a minute the expression admits and leases it for one minute", async () => {
        const { runner, lease } = build(true)
        const run = jest.fn().mockResolvedValue(undefined)
        runner.add(cronJob(run))
        await runner.tick(AT)
        expect(lease.acquire).toHaveBeenCalledWith({ name: "job", holder: expect.any(String), ttlMs: 60_000, at: AT })
        expect(run).toHaveBeenCalledWith(AT)
    })

    it("does not run a cron job twice in the same minute", async () => {
        const { runner } = build(true)
        const run = jest.fn().mockResolvedValue(undefined)
        runner.add(cronJob(run))
        await runner.tick(AT)
        await runner.tick(new Date(AT.getTime() + 20_000))
        expect(run).toHaveBeenCalledTimes(1)
    })

    it("skips the run when another replica holds the lease", async () => {
        const { runner } = build(false)
        const run = jest.fn()
        runner.add(cronJob(run))
        await runner.tick(AT)
        expect(run).not.toHaveBeenCalled()
    })

    it("runs an interval job once per interval and leases it for the interval", async () => {
        const { runner, lease } = build(true)
        const run = jest.fn().mockResolvedValue(undefined)
        runner.add({ name: "job", schedule: { everyMs: 30_000 }, run })
        await runner.tick(AT)
        await runner.tick(new Date(AT.getTime() + 10_000))
        await runner.tick(new Date(AT.getTime() + 30_000))
        expect(run).toHaveBeenCalledTimes(2)
        expect(lease.acquire).toHaveBeenCalledWith(expect.objectContaining({ ttlMs: 30_000 }))
    })

    it("logs a failing run and gives the lease back", async () => {
        const { runner, lease, logger } = build(true)
        runner.add(cronJob(jest.fn().mockRejectedValue(new TypeError("boom"))))
        await runner.tick(AT)
        expect(logger.error).toHaveBeenCalledWith(SchedulingLogEvent.JobFailed, expect.any(TypeError), {
            job: "job",
            fence: 7,
        })
        expect(lease.release).toHaveBeenCalledWith({ grant: { name: "job", holder: "h", fence: 7 } })
    })

    it("refuses a job whose cron expression does not parse", () => {
        const { runner } = build(true)
        expect(() => runner.add({ name: "bad", schedule: { cron: "nope" }, run: jest.fn() })).toThrow(SchedulingError)
    })
})
