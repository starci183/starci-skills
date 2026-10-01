import type { Schedule } from "./scheduling.contracts"

/** One recurring unit of work; a class in `transport/schedule` implements it and dispatches exactly one command or query. */
export interface ScheduledJob {
    /** The unique job name; it is also the name of the lease that keeps one replica per run. */
    readonly name: string
    /** When the job runs. */
    readonly schedule: Schedule
    /** Runs the job for the tick at `at`. */
    run(at: Date): Promise<void>
}

/** Where a schedule transport module registers its jobs. */
export interface JobRegistry {
    /** Registers the job; a cron expression that does not parse is refused. */
    add(job: ScheduledJob): void
}
