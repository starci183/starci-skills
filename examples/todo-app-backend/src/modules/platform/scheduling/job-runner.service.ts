import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLease } from "@modules/platform/lease"
import type { Lease } from "@modules/platform/lease"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { cronMatches, parseCron } from "./cron.policy"
import type { CronFields } from "./cron.policy"
import { SchedulingError, SchedulingErrorCode } from "./errors/scheduling.error"
import { InjectSchedulingOptions } from "./scheduling.decorators"
import { SchedulingLogEvent } from "./scheduling.log-events"
import type { SchedulingOptions } from "./scheduling.options"
import type { JobRegistry, ScheduledJob } from "./scheduling.port"

const MINUTE_MS = 60_000

type Timing =
    /** A cron job: the parsed expression. */
    | { readonly cron: CronFields }
    /** An interval job: the pause between two runs. */
    | { readonly everyMs: number }

interface Entry {
    readonly job: ScheduledJob
    readonly timing: Timing
    /** How long the lease of one run stays valid: the interval, or one minute for cron. */
    readonly ttlMs: number
    /** The tick key of the last run this process attempted: the minute of a cron job, the instant of an interval job. */
    lastKey: number | null
    running: boolean
}

@Injectable()
/**
 * The job registry and the tick loop of a worker. Every tick each due job takes its lease (one replica wins per run,
 * the fence tells grants apart) and runs; a job never overlaps itself in this process. An app that registers no job
 * never ticks.
 */
export class JobRunnerService implements JobRegistry, OnApplicationBootstrap, OnApplicationShutdown {
    private readonly entries: Array<Entry> = []
    private readonly holder = randomUUID()
    private timer: NodeJS.Timeout | undefined
    private stopped = false

    constructor(
        @InjectSchedulingOptions() private readonly options: SchedulingOptions,
        @InjectLease() private readonly lease: Lease,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Registers the job. */
    add(job: ScheduledJob): void {
        if ("cron" in job.schedule) {
            const cron = parseCron(job.schedule.cron)
            if (cron === null) {
                throw new SchedulingError({ code: SchedulingErrorCode.CronInvalid, params: { job: job.name } })
            }
            this.entries.push({ job, timing: { cron }, ttlMs: MINUTE_MS, lastKey: null, running: false })
            return
        }
        this.entries.push({
            job,
            timing: { everyMs: job.schedule.everyMs },
            ttlMs: job.schedule.everyMs,
            lastKey: null,
            running: false,
        })
    }

    /** Starts ticking when at least one job is registered. */
    onApplicationBootstrap(): void {
        if (this.entries.length > 0) this.schedule()
    }

    /** Stops ticking. */
    onApplicationShutdown(): void {
        this.stopped = true
        if (this.timer) clearTimeout(this.timer)
    }

    /** Looks at every registered job once and runs the ones due at `at`. */
    async tick(at: Date): Promise<void> {
        await Promise.all(this.entries.map((entry) => this.runIfDue(entry, at)))
    }

    private schedule(): void {
        this.timer = setTimeout(() => void this.loop(), this.options.tickMs)
    }

    private async loop(): Promise<void> {
        try {
            await this.tick(this.clock.now())
        } finally {
            if (!this.stopped) this.schedule()
        }
    }

    private keyOf(entry: Entry, at: Date): number | null {
        if ("everyMs" in entry.timing) {
            const key = at.getTime()
            return entry.lastKey === null || key - entry.lastKey >= entry.timing.everyMs ? key : null
        }
        const key = Math.floor(at.getTime() / MINUTE_MS)
        return key !== entry.lastKey && cronMatches(entry.timing.cron, at) ? key : null
    }

    private async runIfDue(entry: Entry, at: Date): Promise<void> {
        if (entry.running) return
        const key = this.keyOf(entry, at)
        if (key === null) return
        entry.lastKey = key
        const grant = await this.lease.acquire({ name: entry.job.name, holder: this.holder, ttlMs: entry.ttlMs, at })
        if (grant === null) return
        entry.running = true
        try {
            await entry.job.run(at)
            this.logger.info(SchedulingLogEvent.JobCompleted, {
                job: entry.job.name,
                fence: grant.fence,
                durationMs: this.clock.now().getTime() - at.getTime(),
            })
        } catch (error) {
            this.logger.error(SchedulingLogEvent.JobFailed, error, { job: entry.job.name, fence: grant.fence })
            await this.lease.release({ grant })
        } finally {
            entry.running = false
        }
    }
}
