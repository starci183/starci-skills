import { sql } from "@modules/platform/database"

/** Creates the tasks table unless a seeded database already has it. */
export const CREATE_TASKS_TABLE = sql`CREATE TABLE IF NOT EXISTS tasks (
    id text PRIMARY KEY,
    owner text NOT NULL,
    title text NOT NULL,
    complete boolean NOT NULL DEFAULT false
)`

/** Adds the completion instant the seeded table does not have. */
export const ADD_TASKS_COMPLETED_AT = sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz`

/** Indexes the tasks of one owner. */
export const CREATE_TASKS_OWNER_INDEX = sql`CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks (owner)`

/** Drops the completion instant. */
export const DROP_TASKS_COMPLETED_AT = sql`ALTER TABLE tasks DROP COLUMN IF EXISTS completed_at`
