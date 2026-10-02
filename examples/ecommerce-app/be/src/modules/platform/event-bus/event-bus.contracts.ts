import type { QueueDefinition } from "@modules/platform/messaging"

/** The declaration of one event: its name and version (an entry of the vendored contract `be/contracts/<service>/events.json`), how many deliveries it gets, the base of the backoff between them and how a stored payload is read back. */
export interface EventDefinition<Payload extends object> extends QueueDefinition<Payload> {
    /** The contract version of the payload. */
    readonly version: number
}

/** An event as a service publishes it: its definition, the stable event id the receiver dedupes on, and the payload. */
export interface BusEvent<Payload extends object> {
    /** The declaration of the event. */
    readonly definition: EventDefinition<Payload>
    /** The stable event id: the same logical event always carries the same id. */
    readonly eventId: string
    /** The payload. */
    readonly payload: Payload
}

/** An event as a consumer receives it. */
export interface EventDelivery<Payload extends object> {
    /** The stable event id: the dedupe key of the receiver. */
    readonly eventId: string
    /** The parsed payload. */
    readonly payload: Payload
    /** How many deliveries were started, this one included. */
    readonly attempt: number
}
