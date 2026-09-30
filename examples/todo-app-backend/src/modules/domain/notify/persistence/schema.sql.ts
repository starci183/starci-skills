import { sql } from "@modules/platform/database"

/** Creates the notifications table unless a seeded database already has it. */
export const CREATE_NOTIFICATIONS_TABLE = sql`CREATE TABLE IF NOT EXISTS notify_notifications (
    id text PRIMARY KEY,
    kind text NOT NULL,
    recipient_id text NOT NULL,
    payload jsonb NOT NULL,
    digest_group_id text,
    created_at timestamptz NOT NULL
)`

/** Indexes the notifications of one recipient. */
export const CREATE_NOTIFICATIONS_RECIPIENT_INDEX = sql`CREATE INDEX IF NOT EXISTS notify_notifications_recipient_idx
    ON notify_notifications (recipient_id)`

/** Indexes the notifications of one digest group. */
export const CREATE_NOTIFICATIONS_GROUP_INDEX = sql`CREATE INDEX IF NOT EXISTS notify_notifications_digest_group_idx
    ON notify_notifications (digest_group_id)`

/** Creates the delivery attempts table: one row per notification. */
export const CREATE_DELIVERY_ATTEMPTS_TABLE = sql`CREATE TABLE IF NOT EXISTS notify_delivery_attempts (
    notification_id text PRIMARY KEY REFERENCES notify_notifications (id),
    state text NOT NULL,
    attempt integer NOT NULL DEFAULT 0,
    failure_class text,
    started_at timestamptz,
    ended_at timestamptz,
    history jsonb NOT NULL DEFAULT '[]'::jsonb
)`

/** Indexes the delivery attempts by state. */
export const CREATE_DELIVERY_ATTEMPTS_STATE_INDEX = sql`CREATE INDEX IF NOT EXISTS notify_delivery_attempts_state_idx
    ON notify_delivery_attempts (state)`

/** Creates the preferences table: one row per person and channel. */
export const CREATE_PREFERENCES_TABLE = sql`CREATE TABLE IF NOT EXISTS notify_preferences (
    person_id text NOT NULL,
    channel text NOT NULL,
    unsubscribed boolean NOT NULL DEFAULT false,
    digest_window_minutes integer,
    PRIMARY KEY (person_id, channel)
)`

/** Creates the digest windows table. */
export const CREATE_DIGEST_WINDOWS_TABLE = sql`CREATE TABLE IF NOT EXISTS notify_digest_windows (
    id text PRIMARY KEY,
    person_id text NOT NULL,
    channel text NOT NULL,
    opens_at timestamptz NOT NULL,
    closes_at timestamptz NOT NULL,
    flushed_at timestamptz
)`

/** Indexes the open window of a person and a channel. */
export const CREATE_DIGEST_WINDOWS_OPEN_INDEX = sql`CREATE INDEX IF NOT EXISTS notify_digest_windows_open_idx
    ON notify_digest_windows (person_id, channel) WHERE flushed_at IS NULL`

/** Drops the digest windows table. */
export const DROP_DIGEST_WINDOWS_TABLE = sql`DROP TABLE IF EXISTS notify_digest_windows`

/** Drops the preferences table. */
export const DROP_PREFERENCES_TABLE = sql`DROP TABLE IF EXISTS notify_preferences`

/** Drops the delivery attempts table. */
export const DROP_DELIVERY_ATTEMPTS_TABLE = sql`DROP TABLE IF EXISTS notify_delivery_attempts`

/** Drops the notifications table. */
export const DROP_NOTIFICATIONS_TABLE = sql`DROP TABLE IF EXISTS notify_notifications`
