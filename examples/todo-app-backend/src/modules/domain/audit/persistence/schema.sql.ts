import { sql } from "@modules/platform/database"

/** Creates the audit log lines table unless it already exists; id is the chain position. */
export const CREATE_AUDIT_LOG_LINES_TABLE = sql`CREATE TABLE IF NOT EXISTS audit_log_lines (
    id bigserial PRIMARY KEY,
    at timestamptz NOT NULL,
    action text NOT NULL,
    target text,
    key_id text NOT NULL,
    actor text NOT NULL,
    prev_hash text NOT NULL,
    hash text NOT NULL
)`

/** Indexes the lines of one key. */
export const CREATE_AUDIT_LOG_LINES_KEY_INDEX = sql`CREATE INDEX IF NOT EXISTS audit_log_lines_key_id_idx ON audit_log_lines (key_id)`

/** Creates the keystore table unless it already exists. */
export const CREATE_AUDIT_KEYS_TABLE = sql`CREATE TABLE IF NOT EXISTS audit_keys (
    person_id text PRIMARY KEY,
    key_id text NOT NULL UNIQUE,
    key text NOT NULL,
    created_at timestamptz NOT NULL
)`

/** Creates the erasure requests table unless it already exists; person_id is nullable because completion drops it. */
export const CREATE_AUDIT_ERASURE_REQUESTS_TABLE = sql`CREATE TABLE IF NOT EXISTS audit_erasure_requests (
    request_id text PRIMARY KEY,
    person_id text,
    state text NOT NULL,
    requested_at timestamptz NOT NULL,
    verified_at timestamptz,
    refused_at timestamptz,
    executing_at timestamptz,
    completed_at timestamptz
)`

/** Drops the erasure requests table. */
export const DROP_AUDIT_ERASURE_REQUESTS_TABLE = sql`DROP TABLE IF EXISTS audit_erasure_requests`

/** Drops the keystore table. */
export const DROP_AUDIT_KEYS_TABLE = sql`DROP TABLE IF EXISTS audit_keys`

/** Drops the audit log lines table. */
export const DROP_AUDIT_LOG_LINES_TABLE = sql`DROP TABLE IF EXISTS audit_log_lines`
