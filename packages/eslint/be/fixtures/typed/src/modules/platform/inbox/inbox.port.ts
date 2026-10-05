import type { EntityManager } from "typeorm"

/** Claims a provider event once. */
export interface Inbox {
    /** True when the event is new; with tx the claim shares the caller transaction. */
    claim(source: string, eventId: string, tx?: EntityManager): Promise<boolean>
}
