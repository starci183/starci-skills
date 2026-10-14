/** The base of each typed event in modules/events: its stable identity, name and payload. */
export abstract class BaseEvent {
    /** A receiver uses this stable identity to deduplicate redelivery. */
    abstract readonly eventId: string
    /** The event name listed by the service's vendored event contract. */
    abstract readonly eventName: string
    /** The fact that a reactor or job processes after commit. */
    abstract readonly payload: object
}

/** Parsing either returns the event or refuses a mismatched envelope. */
export type ParsedEvent<Event extends BaseEvent> = Event | null

/** The class side of a typed event, shared by publishers and later consumers. */
export interface EventClass<Event extends BaseEvent> {
    /** The contract's event name. */
    readonly eventName: string
    /** The contract's payload version. */
    readonly version: number
    /** Reads the event from its durable envelope. */
    parse(envelope: unknown): ParsedEvent<Event>
}

/** One committed delivery received by a reactor. */
export interface EventDelivery<Event extends BaseEvent> {
    /** The consumer's idempotency key. */
    readonly eventId: string
    /** The typed event. */
    readonly event: Event
    /** The number of attempts, including this one. */
    readonly attempt: number
}

/** The typed event's durable envelope, read only after the intake transaction commits. */
export interface EventEnvelope {
    /** The stable event id. */
    readonly eventId: string
    /** The contract's event name. */
    readonly eventName: string
    /** The data of the fact. */
    readonly payload: object
}
