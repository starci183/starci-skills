import { sql } from "@modules/platform/database"

/**
 * Takes the transaction-scoped lock that serializes appends to the hash chain, so two concurrent appends never read the
 * same previous hash and fork the chain. The lock is released when the transaction ends.
 */
export const LOCK_AUDIT_CHAIN = sql`SELECT pg_advisory_xact_lock(hashtext('audit.chain'))`
