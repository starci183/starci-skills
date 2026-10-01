/** Log events of the messaging capability. */
export enum MessagingLogEvent {
    /** A poll of the store failed; the next poll runs anyway. */
    PollFailed = "messaging.poll.failed",
    /** A delivery failed and was scheduled again; the queue and the attempt ride in the fields. */
    DeliveryRetried = "messaging.delivery.retried",
    /** A message ran out of attempts and was buried. */
    DeliveryBuried = "messaging.delivery.buried",
}
