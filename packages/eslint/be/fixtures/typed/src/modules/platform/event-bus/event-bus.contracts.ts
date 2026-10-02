/** The base every typed event class extends. */
export abstract class BaseEvent {
    abstract readonly eventId: string
}

/** One delivery of an event to a consumer. */
export interface EventDelivery<E extends BaseEvent> {
    readonly eventId: string
    readonly event: E
    readonly attempt: number
}

/** A concrete event class: its literal name and version, and how a delivered payload becomes the event. */
export interface EventClass<E extends BaseEvent> {
    readonly eventName: string
    readonly version: number
    parse(value: unknown): E | null
}
