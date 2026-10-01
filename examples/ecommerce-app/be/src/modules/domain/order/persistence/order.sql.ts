import { sql } from "@modules/platform/database"

/**
 * Inserts a confirmed order unless the person already used the idempotency key ($1 person, $2 total, $3 currency, $4
 * key or null); answers the new id, or no row when the key was used.
 */
export const INSERT_ORDER_IF_NEW = sql`INSERT INTO orders (person_id, status, total_minor_units, currency, idempotency_key)
    VALUES ($1, 'confirmed', $2, $3, $4)
    ON CONFLICT (person_id, idempotency_key) DO NOTHING RETURNING id`

/** Counts the orders of one person ($1). */
export const COUNT_PERSON_ORDERS = sql`SELECT count(*)::int AS order_count FROM orders WHERE person_id = $1`
