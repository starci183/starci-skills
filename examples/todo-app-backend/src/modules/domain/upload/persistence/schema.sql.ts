import { sql } from "@modules/platform/database"

/** Creates the uploads table unless a seeded database already has it. */
export const CREATE_UPLOADS_TABLE = sql`CREATE TABLE IF NOT EXISTS uploads (
    id text PRIMARY KEY,
    owner text NOT NULL,
    task_id text,
    filename text NOT NULL,
    mime text NOT NULL,
    size_bytes integer NOT NULL,
    storage_key text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL
)`

/** Indexes the uploads of one owner. */
export const CREATE_UPLOADS_OWNER_INDEX = sql`CREATE INDEX IF NOT EXISTS uploads_owner_idx ON uploads (owner)`

/** Indexes the uploads of one task. */
export const CREATE_UPLOADS_TASK_INDEX = sql`CREATE INDEX IF NOT EXISTS uploads_task_id_idx ON uploads (task_id)`

/** Drops the uploads table. */
export const DROP_UPLOADS_TABLE = sql`DROP TABLE IF EXISTS uploads`
