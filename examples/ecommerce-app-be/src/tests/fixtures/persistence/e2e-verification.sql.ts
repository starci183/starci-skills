import { sql } from "@modules/platform/database"

/** The tables of the public schema ($none): what the migrations created. */
export const PUBLIC_TABLES = sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 500`

/** One person by id ($1). */
export const PERSON_BY_ID = sql`SELECT id, email FROM persons WHERE id = $1`

/** The status and total of one order ($1 order id). */
export const ORDER_SUMMARY = sql`SELECT status, total_minor_units FROM orders WHERE id = $1`

/** How many lines one order has ($1 order id). */
export const ORDER_LINE_COUNT = sql`SELECT count(*)::int AS count FROM order_lines WHERE order_id = $1`

/** How many orders one person has ($1 person id). */
export const ORDER_COUNT = sql`SELECT count(*)::int AS count FROM orders WHERE person_id = $1`

/** The orders of one person in creation order ($1 person id). */
export const ORDERS_OF_PERSON = sql`SELECT id, status, total_minor_units, currency, idempotency_key FROM orders
    WHERE person_id = $1 ORDER BY created_at, id LIMIT 100`

/** The lines of one order with their price snapshot ($1 order id). */
export const LINES_OF_ORDER = sql`SELECT product_id, quantity, unit_price_minor_units FROM order_lines
    WHERE order_id = $1 ORDER BY product_id LIMIT 100`

/** How many cart lines one person holds ($1 person id). */
export const CART_ITEM_COUNT = sql`SELECT count(*)::int AS count FROM cart_items WHERE person_id = $1`

/** The payments of one person in capture order ($1 person id). */
export const PAYMENTS_OF_PERSON = sql`SELECT id, order_id, status, amount_minor_units FROM payments
    WHERE person_id = $1 ORDER BY created_at, id LIMIT 100`

/** How many payments one person has ($1 person id). */
export const PAYMENT_COUNT = sql`SELECT count(*)::int AS count FROM payments WHERE person_id = $1`

/** The stock of one product ($1 SKU). */
export const STOCK_OF = sql`SELECT stock FROM products WHERE id = $1`

/** Sets the stock of one product ($1 SKU, $2 units): a spec starts from the stock it relies on. */
export const SET_STOCK = sql`UPDATE products SET stock = $2 WHERE id = $1`
