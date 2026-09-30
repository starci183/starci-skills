import { sql } from "@modules/platform/database"

/** Creates the persons table. */
export const CREATE_PERSONS_TABLE = sql`CREATE TABLE persons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
)`

/** Drops the persons table. */
export const DROP_PERSONS_TABLE = sql`DROP TABLE persons`
