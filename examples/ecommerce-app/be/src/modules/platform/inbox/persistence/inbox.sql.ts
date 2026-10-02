import { sql } from "@modules/platform/database"

/** Claims the event ($1 source, $2 event id, $3 instant); answers one row when this call won and none when it was claimed before. */
export const CLAIM_EVENT = sql`INSERT INTO inbox_claims (source, event_id, claimed_at) VALUES ($1, $2, $3)
    ON CONFLICT (source, event_id) DO NOTHING RETURNING event_id`

/** Gives the claim of the event ($1 source, $2 event id) back. */
export const RELEASE_EVENT = sql`DELETE FROM inbox_claims WHERE source = $1 AND event_id = $2`
