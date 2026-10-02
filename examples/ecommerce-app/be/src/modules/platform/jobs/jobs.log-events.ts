/** Log events of the jobs. */
export enum JobsLogEvent {
    /** A write of a stale worker was refused: a newer worker owns the job and this one stopped with no further effect. */
    FencedOut = "jobs.fenced-out",
    /** A delivery failed and the job was marked failed for BullMQ to retry. */
    DeliveryFailed = "jobs.delivery.failed",
    /** A failed delivery could not even be recorded as failed; the lease will expire and the job will be claimed again. */
    FailureNotRecorded = "jobs.delivery.failure-not-recorded",
}
