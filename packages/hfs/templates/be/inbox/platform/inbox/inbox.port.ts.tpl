import type { EntityManager } from "typeorm"

/** The signed provider header may omit its delivery identity; the adapter refuses that delivery. */
export type InboxEventId = string | undefined

/** Deduplicates a delivery inside the transaction that records its receipt or applies its effect. */
export interface Inbox {
    /** Claims once per source and event id; a rolled-back transaction gives the claim back automatically. */
    claim(source: string, eventId: InboxEventId, tx: EntityManager): Promise<boolean>
}
