import { sql } from "@modules/platform/database"

/**
 * Marks a pending order paid ($1 order id, $2 the instant it was paid); answers its buyer and total, or no row when the order is
 * not pending any more (already paid, expired or cancelled).
 */
export const MARK_ORDER_PAID_IF_PENDING = sql`UPDATE orders SET status = 'paid', paid_at = $2
    WHERE id = $1 AND status = 'pending' RETURNING person_id, total_minor_units`

/**
 * Expires the pending orders placed at or before the cutoff ($1 cutoff, $2 the most orders one run expires); answers the id and
 * buyer of each order it expired.
 */
export const EXPIRE_PENDING_ORDERS_PLACED_BEFORE = sql`UPDATE orders SET status = 'expired'
    WHERE id IN (SELECT id FROM orders WHERE status = 'pending' AND created_at <= $1 ORDER BY created_at LIMIT $2 FOR UPDATE SKIP LOCKED)
    RETURNING id, person_id`
