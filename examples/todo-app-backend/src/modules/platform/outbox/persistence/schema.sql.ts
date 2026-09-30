import { sql } from "@modules/platform/database"

/** Creates the outbox table with its status check and its uniqueness per queue. */
export const CREATE_OUTBOX_MESSAGES_TABLE = sql`CREATE TABLE outbox_messages (
    id uuid PRIMARY KEY,
    queue varchar(120) NOT NULL,
    event_id varchar(200) NOT NULL,
    payload jsonb NOT NULL,
    available_at timestamptz NOT NULL,
    attempts int NOT NULL DEFAULT 0,
    status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'dead')),
    last_error text,
    created_at timestamptz NOT NULL,
    UNIQUE (queue, event_id)
)`

/** Indexes the claim: pending messages by due instant. */
export const CREATE_OUTBOX_DUE_INDEX = sql`CREATE INDEX outbox_messages_due_idx ON outbox_messages (available_at) WHERE status = 'pending'`

/** Drops the outbox table. */
export const DROP_OUTBOX_MESSAGES_TABLE = sql`DROP TABLE outbox_messages`
