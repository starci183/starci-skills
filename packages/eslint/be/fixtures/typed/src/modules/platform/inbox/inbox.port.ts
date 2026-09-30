/** Claims a provider event once. */
export interface Inbox {
    /** True when the event is new. */
    claim(source: string, eventId: string): Promise<boolean>
}
