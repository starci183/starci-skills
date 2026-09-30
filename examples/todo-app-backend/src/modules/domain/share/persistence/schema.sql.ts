import { sql } from "@modules/platform/database"

/** Creates the invitations table unless it already exists. */
export const CREATE_INVITATIONS_TABLE = sql`CREATE TABLE IF NOT EXISTS invitations (
    id text PRIMARY KEY,
    task_id text NOT NULL,
    owner_id text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    sent_at timestamptz NOT NULL,
    accepted_at timestamptz,
    revoked_at timestamptz,
    person_id text
)`

/** Keeps exactly one row per (task, email) pair. */
export const CREATE_INVITATIONS_TASK_EMAIL_INDEX = sql`CREATE UNIQUE INDEX IF NOT EXISTS invitations_task_email_idx ON invitations (task_id, email)`

/** Indexes the invitations of one task. */
export const CREATE_INVITATIONS_TASK_INDEX = sql`CREATE INDEX IF NOT EXISTS invitations_task_idx ON invitations (task_id)`

/** Indexes the invitations bound to one person. */
export const CREATE_INVITATIONS_PERSON_INDEX = sql`CREATE INDEX IF NOT EXISTS invitations_person_idx ON invitations (person_id)`

/** Drops the invitations table. */
export const DROP_INVITATIONS_TABLE = sql`DROP TABLE IF EXISTS invitations`
