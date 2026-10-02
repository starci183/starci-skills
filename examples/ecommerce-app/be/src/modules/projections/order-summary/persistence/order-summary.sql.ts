import { sql } from "@modules/platform/database"

/**
 * The facts one summary is computed from, read from the order context's own tables ($1 one order id, or null for every order
 * after the cursor; $2 the cursor: only orders with a greater id; $3 the most orders to answer, in id order).
 */
export const LOAD_ORDER_SUMMARY_FACTS = sql`SELECT o.id AS order_id, o.person_id, o.status, o.total_minor_units, o.created_at AS placed_at, o.paid_at,
    (SELECT count(*)::int FROM order_lines l WHERE l.order_id = o.id) AS line_count,
    (SELECT coalesce(sum(e.points), 0)::int FROM loyalty_entries e WHERE e.order_id = o.id) AS loyalty_points
  FROM orders o
  WHERE ($1::uuid IS NULL OR o.id = $1::uuid) AND ($2::uuid IS NULL OR o.id > $2::uuid)
  ORDER BY o.id
  LIMIT $3`
