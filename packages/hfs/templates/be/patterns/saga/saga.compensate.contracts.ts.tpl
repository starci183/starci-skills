/** What the event that reports the failure carries: the id it is about and the id of the delivery (the inbox dedupe key). */
export interface Compensate@@Saga@@Request {
    /** The id the saga run is about. */
    readonly id: string
    /** The id of the delivered event. */
    readonly eventId: string
}
