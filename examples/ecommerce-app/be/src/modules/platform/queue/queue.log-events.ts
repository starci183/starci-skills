/** Log events of the queues. */
export enum QueueLogEvent {
    /** A relay pass over a queue outbox failed; the next pass tries again. */
    RelayFailed = "queue.relay.failed",
    /** A scheduler could not be registered at boot. */
    SchedulerFailed = "queue.scheduler.failed",
}
