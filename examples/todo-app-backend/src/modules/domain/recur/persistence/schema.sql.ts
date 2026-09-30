import { sql } from "@modules/platform/database"

/** Creates the recurrence rules table. */
export const CREATE_RECURRENCE_RULES_TABLE = sql`CREATE TABLE IF NOT EXISTS recurrence_rules (
    id text PRIMARY KEY,
    owner text NOT NULL,
    title text NOT NULL,
    frequency text NOT NULL,
    n integer,
    day_of_month integer,
    time_zone text NOT NULL,
    time text NOT NULL,
    start_date text NOT NULL,
    ended_at text
)`

/** Indexes the rules of one owner. */
export const CREATE_RECURRENCE_RULES_OWNER_INDEX = sql`CREATE INDEX IF NOT EXISTS recurrence_rules_owner_idx ON recurrence_rules (owner)`

/** Creates the occurrences table: the id is the id of the task the occurrence spawned. */
export const CREATE_OCCURRENCES_TABLE = sql`CREATE TABLE IF NOT EXISTS occurrences (
    id text PRIMARY KEY,
    rule_id text NOT NULL,
    window_key text NOT NULL,
    local_date text NOT NULL,
    due_at_utc timestamptz NOT NULL,
    status text NOT NULL
)`

/** Makes the window key unique across all occurrences, which is what makes generation idempotent. */
export const CREATE_OCCURRENCES_WINDOW_KEY_INDEX = sql`CREATE UNIQUE INDEX IF NOT EXISTS occurrences_window_key_key ON occurrences (window_key)`

/** Indexes the occurrences of one rule. */
export const CREATE_OCCURRENCES_RULE_INDEX = sql`CREATE INDEX IF NOT EXISTS occurrences_rule_id_idx ON occurrences (rule_id)`

/** Drops the occurrences table. */
export const DROP_OCCURRENCES_TABLE = sql`DROP TABLE IF EXISTS occurrences`

/** Drops the recurrence rules table. */
export const DROP_RECURRENCE_RULES_TABLE = sql`DROP TABLE IF EXISTS recurrence_rules`
