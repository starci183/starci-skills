import { sql } from "@modules/platform/database"

/** Creates the payments table. */
export const CREATE_PAYMENTS_TABLE = sql`CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    order_id uuid NOT NULL UNIQUE,
    amount_minor_units int NOT NULL CHECK (amount_minor_units >= 0),
    status varchar(16) NOT NULL CHECK (status IN ('captured')),
    created_at timestamptz NOT NULL DEFAULT now()
)`

/** Drops the payments table. */
export const DROP_PAYMENTS_TABLE = sql`DROP TABLE payments`
