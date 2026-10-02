/** Log events of the outbox relay. */
export enum OutboxLogEvent {
    /** A relay pass over an outbox failed; the next pass tries again. The `outbox` field names which outbox. */
    RelayFailed = "outbox.relay.failed",
}
