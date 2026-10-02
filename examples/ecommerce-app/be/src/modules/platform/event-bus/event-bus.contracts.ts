/** The base of every typed event (`modules/events/<service>/<event>.event.ts`): who it is and what it carries. */
export abstract class BaseEvent {
    /** The stable event id: the same logical event always carries the same id, so a receiver can dedupe. */
    abstract readonly eventId: string

    /** The event name, `<service>.<what>`: an entry of the vendored contract `be/contracts/<service>/events.json`. */
    abstract readonly eventName: string

    /** The data of the event. */
    abstract readonly payload: object
}

/** The class side of a typed event: its name and version (the vendored contract), the event it compensates when it reports a failure, and how a received envelope is read back. */
export interface EventClass<Event extends BaseEvent> {
    /** The event name. */
    readonly eventName: string
    /** The contract version of the payload. */
    readonly version: number
    /** Reads a received envelope `{ eventId, payload }` back into the event; null when it does not have the shape. */
    parse(envelope: unknown): Event | null
}

/** An event as a consumer receives it. */
export interface EventDelivery<Event extends BaseEvent> {
    /** The stable event id: the dedupe key of the receiver. */
    readonly eventId: string
    /** The event. */
    readonly event: Event
    /** How many deliveries were started, this one included. */
    readonly attempt: number
}

/** An event that ran out of attempts and waits for an operator. */
export interface EventDeadLetter {
    /** The id of the dead letter, what `requeue` takes. */
    readonly id: string
    /** The event name. */
    readonly eventName: string
    /** The stable event id. */
    readonly eventId: string
    /** Why the last delivery failed. */
    readonly reason: string
    /** How many deliveries were tried. */
    readonly attempts: number
}
