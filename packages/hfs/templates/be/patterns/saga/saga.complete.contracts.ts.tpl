/** What the event that reports the last step done carries: the id it is about and the id of the delivery (the inbox dedupe key). */
export interface Complete@@Saga@@Request {
    /** The id the saga run is about. */
    readonly id: string
    /** The id of the delivered event. */
    readonly eventId: string
}
