/** Log events of the event bus. */
export enum EventBusLogEvent {
    /** A delivery failed and the event waits on the retry topic; the event and the attempt ride in the fields. */
    DeliveryRetried = "event-bus.delivery.retried",
    /** An event ran out of attempts and was put on the dead-letter topic. */
    DeliveryBuried = "event-bus.delivery.buried",
    /** A relay pass over the outbox failed; the next pass tries again. */
    RelayFailed = "event-bus.relay.failed",
    /** A received message is not an envelope of a registered event and was left alone. */
    MessageSkipped = "event-bus.message.skipped",
}
