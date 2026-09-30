/** A five-field cron expression (minute hour day-of-month month day-of-week), evaluated in UTC. */
export interface CronSchedule {
    /** The expression, for example five fields with a step of five in the minute field. */
    readonly cron: string
}

/** A fixed pause between two runs. */
export interface IntervalSchedule {
    /** The pause in milliseconds. */
    readonly everyMs: number
}

/** When a job runs. */
export type Schedule = CronSchedule | IntervalSchedule
