import type { EventDefinition } from "./event-bus.contracts"

/** Declares an event; the typed event class of `modules/events/<service>` exports the result, and its publisher and its consumers use it. */
export const defineEvent = <Payload extends object>(definition: EventDefinition<Payload>): EventDefinition<Payload> =>
    definition
