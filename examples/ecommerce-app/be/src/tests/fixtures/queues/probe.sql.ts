import { sql } from "@modules/platform/database"
import type { RowQuery } from "../persistence/e2e-verification.rows"

/** One queue outbox row of the probe queue. */
export interface QueueRow {
    /** The row id: the BullMQ job id once the relay hands it over. */
    id: string
    /** The note of the payload. */
    note: string
    /** True once the relay marked the row sent. */
    sent: boolean
}

/** The probe outbox rows with one note ($1 note). */
export const PROBE_ROWS_OF_NOTE: RowQuery<QueueRow> = {
    text: sql`SELECT id::text AS id, payload->>'note' AS note, sent_at IS NOT NULL AS sent FROM queue_outbox WHERE queue = 'probe' AND payload->>'note' = $1 ORDER BY created_at LIMIT 500`,
}

/** One job row as the fence leaves it. */
export interface JobRow {
    /** The lifecycle state. */
    status: string
    /** The token of the last claim, as text (a bigint). */
    fencing_token: string
    /** The last recorded step. */
    current_step: string | null
}

/** The job row of a key ($1 job key). */
export const JOB_OF_KEY: RowQuery<JobRow> = {
    text: sql`SELECT status, fencing_token::text AS fencing_token, current_step FROM jobs WHERE job_key = $1 LIMIT 5`,
}
