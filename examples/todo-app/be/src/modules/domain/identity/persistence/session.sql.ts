import { sql } from "@modules/platform/database"

/** Deletes every session that lapsed at or before $1; a DELETE answers its rows and their count. */
export const PURGE_LAPSED_SESSIONS = sql`DELETE FROM sessions WHERE expires_at <= $1 RETURNING token`
