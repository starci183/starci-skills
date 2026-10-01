/** Log events of the scheduling capability. */
export enum SchedulingLogEvent {
    /** A job run finished; the job name and the duration ride in the fields. */
    JobCompleted = "scheduling.job.completed",
    /** A job run threw; the lease was given back so the next tick can retry. */
    JobFailed = "scheduling.job.failed",
    /** A tick could not look at its jobs (the lease store dropped the connection); the next tick tries again. */
    TickFailed = "scheduling.tick.failed",
}
