import type { @@Event@@Event } from "@modules/events/@@from@@"

/** What applying one delivered @@event@@ event takes. */
export interface @@Action@@Request {
    /** The id of the delivered event; the domain service claims it in the inbox inside its own transaction. */
    readonly eventId: string
    /** The delivered event. */
    readonly event: @@Event@@Event
}

/** Applying an event answers nothing: a redelivery is a no-op. */
export type @@Action@@Result = void
