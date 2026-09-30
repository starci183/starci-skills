import { sql } from "@modules/platform/database"

/** Creates the sessions table unless a seeded database already has it. */
export const CREATE_SESSIONS_TABLE = sql`CREATE TABLE IF NOT EXISTS sessions (
    token text PRIMARY KEY,
    person_id text NOT NULL,
    issued_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL
)`

/** Indexes the sessions of one person. */
export const CREATE_SESSIONS_PERSON_INDEX = sql`CREATE INDEX IF NOT EXISTS sessions_person_id_idx ON sessions (person_id)`

/** Drops the sessions table. */
export const DROP_SESSIONS_TABLE = sql`DROP TABLE IF EXISTS sessions`
