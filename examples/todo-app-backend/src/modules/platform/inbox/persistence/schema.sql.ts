import { sql } from "@modules/platform/database"

/** Creates the inbox claims table. */
export const CREATE_INBOX_CLAIMS_TABLE = sql`CREATE TABLE inbox_claims (
    source varchar(200) NOT NULL,
    event_id varchar(200) NOT NULL,
    claimed_at timestamptz NOT NULL,
    PRIMARY KEY (source, event_id)
)`

/** Drops the inbox claims table. */
export const DROP_INBOX_CLAIMS_TABLE = sql`DROP TABLE inbox_claims`
