import type { EntityManager } from "typeorm"

/** Deduplicates deliveries by the source and event id of their consumer. */
export interface Inbox {
    /** True for the first claim; with `tx`, the claim commits or rolls back with the caller's effect. */
    claim(source: string, eventId: string, tx?: EntityManager): Promise<boolean>
    /** Gives a separately committed claim back after a failed attempt; a transaction-owned claim rolls back with its effect. */
    release(source: string, eventId: string): Promise<void>
}
