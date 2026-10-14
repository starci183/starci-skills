/** Log events of the queues. */
export enum QueueLogEvent {
    /** A worker could not read its queue; it waits and reads again. */
    ReadFailed = "queue.read.failed",
    /** A delivery failed and its message becomes visible again after the backoff of its next attempt. */
    DeliveryFailed = "queue.delivery.failed",
    /** A delivery failed on its last attempt; its message is archived and the job is not retried. */
    DeadLettered = "queue.delivery.dead-lettered",
    /** A message could not be archived or rescheduled; it reappears after its visibility timeout. */
    SettleFailed = "queue.delivery.settle-failed",
}
