/** Log events of the messaging capability. */
export enum MessagingLogEvent {
    /** A delivery failed and BullMQ will deliver it again after the backoff; the queue and the attempt ride in the fields. */
    DeliveryRetried = "messaging.delivery.retried",
    /** A message ran out of attempts and waits in the dead letters of its queue. */
    DeliveryBuried = "messaging.delivery.buried",
    /** A worker of a queue reported an error of its own (not a failed delivery). */
    WorkerFailed = "messaging.worker.failed",
}
