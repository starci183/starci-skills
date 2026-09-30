/** Deduplicates deliveries: a consumer or a signed webhook claims the event before it does anything else. */
export interface Inbox {
    /** True when this call is the first to claim the pair (source, eventId); false when it was already claimed and the caller must do nothing. */
    claim(source: string, eventId: string): Promise<boolean>
    /** Gives the claim back after a failed attempt, so a redelivery of the same event is processed again. */
    release(source: string, eventId: string): Promise<void>
}
