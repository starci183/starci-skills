import { sql } from "@modules/platform/database"

/** Claims the event ($1 source, $2 event id, $3 instant); answers one row when this call won and none when it was claimed before. */
export const CLAIM_SAGA_EVENT = sql`INSERT INTO saga_event_claims (source, event_id, claimed_at) VALUES ($1, $2, $3)
    ON CONFLICT (source, event_id) DO NOTHING RETURNING event_id`

/** Gives the claim of the event ($1 source, $2 event id) back. */
export const RELEASE_SAGA_EVENT = sql`DELETE FROM saga_event_claims WHERE source = $1 AND event_id = $2`

/** Starts a saga run ($1 saga, $2 correlation id, $3 instant) at version 1; a run that already exists is left as it is. */
export const BEGIN_SAGA = sql`INSERT INTO saga_states (saga, correlation_id, status, version, updated_at)
    VALUES ($1, $2, 'running', 1, $3) ON CONFLICT (saga, correlation_id) DO NOTHING`

/** The status and the fence of a saga run ($1 saga, $2 correlation id); no row when the run does not exist. */
export const READ_SAGA = sql`SELECT status, version FROM saga_states WHERE saga = $1 AND correlation_id = $2`

/**
 * Moves a saga run from one status to the next ($1 saga, $2 correlation id, $3 the status it must be in, $4 the version
 * it was read at, $5 the new status, $6 instant); answers the new version, or no row when another transition moved it first.
 * The update sits in a CTE because `EntityManager.query` answers an UPDATE ... RETURNING as `[rows, count]`, and a SELECT as the rows.
 */
export const MOVE_SAGA = sql`WITH moved AS (
        UPDATE saga_states SET status = $5, version = version + 1, updated_at = $6
        WHERE saga = $1 AND correlation_id = $2 AND status = $3 AND version = $4 RETURNING version
    ) SELECT version FROM moved`
