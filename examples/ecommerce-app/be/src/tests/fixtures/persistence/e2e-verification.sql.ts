import { sql } from "@modules/platform/database"
import type {
    CountRow,
    InvoiceRow,
    OutboxStateRow,
    OrderLineRow,
    OrderRow,
    OrderSummaryRow,
    SagaStateRow,
    PaymentRow,
    PersonRow,
    RowQuery,
    StockRow,
    TableRow,
} from "./e2e-verification.rows"

/** The tables of the public schema ($none): what the migrations created. */
export const PUBLIC_TABLES: RowQuery<TableRow> = {
    text: sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 500`,
}

/** One person by id ($1). */
export const PERSON_BY_ID: RowQuery<PersonRow> = { text: sql`SELECT id, email FROM persons WHERE id = $1` }

/** The status and total of one order ($1 order id). */
export const ORDER_SUMMARY: RowQuery<OrderSummaryRow> = {
    text: sql`SELECT status, total_minor_units FROM orders WHERE id = $1`,
}

/** How many lines one order has ($1 order id). */
export const ORDER_LINE_COUNT: RowQuery<CountRow> = {
    text: sql`SELECT count(*)::int AS count FROM order_lines WHERE order_id = $1`,
}

/** How many orders one person has ($1 person id). */
export const ORDER_COUNT: RowQuery<CountRow> = {
    text: sql`SELECT count(*)::int AS count FROM orders WHERE person_id = $1`,
}

/** The orders of one person in creation order ($1 person id). */
export const ORDERS_OF_PERSON: RowQuery<OrderRow> = {
    text: sql`SELECT id, status, total_minor_units, currency, idempotency_key FROM orders
    WHERE person_id = $1 ORDER BY created_at, id LIMIT 100`,
}

/** The lines of one order with their price snapshot ($1 order id). */
export const LINES_OF_ORDER: RowQuery<OrderLineRow> = {
    text: sql`SELECT product_id, quantity, unit_price_minor_units FROM order_lines
    WHERE order_id = $1 ORDER BY product_id LIMIT 100`,
}

/** How many cart lines one person holds ($1 person id). */
export const CART_ITEM_COUNT: RowQuery<CountRow> = {
    text: sql`SELECT count(*)::int AS count FROM cart_items WHERE person_id = $1`,
}

/** The payments of one person in capture order ($1 person id). */
export const PAYMENTS_OF_PERSON: RowQuery<PaymentRow> = {
    text: sql`SELECT id, order_id, status, amount_minor_units FROM payments
    WHERE person_id = $1 ORDER BY created_at, id LIMIT 100`,
}

/** How many payments one person has ($1 person id). */
export const PAYMENT_COUNT: RowQuery<CountRow> = {
    text: sql`SELECT count(*)::int AS count FROM payments WHERE person_id = $1`,
}

/** The invoices of one order ($1 order id): at most one, whatever the redeliveries. */
export const INVOICES_OF_ORDER: RowQuery<InvoiceRow> = {
    text: sql`SELECT order_id, status, total_minor_units FROM invoices WHERE order_id = $1 LIMIT 10`,
}

/** The cancelled order with this id ($1 order id): one row, or none while it is still confirmed. */
export const CANCELLED_ORDER: RowQuery<OrderSummaryRow> = {
    text: sql`SELECT status, total_minor_units FROM orders WHERE id = $1 AND status = 'cancelled'`,
}

/** The state of the place-order saga run of one order ($1 order id). */
export const PLACE_ORDER_SAGA_STATE: RowQuery<SagaStateRow> = {
    text: sql`SELECT status, version FROM saga_states WHERE saga = 'place-order' AND correlation_id = $1`,
}

/** How many invoices the billing database holds for the orders of one person ($1 person id). */
export const INVOICE_COUNT_OF_PERSON: RowQuery<CountRow> = {
    text: sql`SELECT count(*)::int AS count FROM invoices WHERE person_id = $1`,
}

/** How many events the billing inbox claimed ($1 source). */
export const INBOX_CLAIM_COUNT: RowQuery<CountRow> = {
    text: sql`SELECT count(*)::int AS count FROM inbox_claims WHERE source = $1`,
}

/** The stock of one product ($1 SKU). */
export const STOCK_OF: RowQuery<StockRow> = { text: sql`SELECT stock FROM products WHERE id = $1` }

/** How many products the catalog holds. */
export const PRODUCT_COUNT: RowQuery<CountRow> = { text: sql`SELECT count(*)::int AS count FROM products` }

/** The outbox rows of one event id in write order ($1 event id): the name, the topic and whether the relay sent it. */
export const OUTBOX_OF_EVENT: RowQuery<OutboxStateRow> = {
    text: sql`SELECT event_name, topic, sent_at IS NOT NULL AS sent FROM event_outbox WHERE event_id = $1 ORDER BY id LIMIT 500`,
}

/** Writes the outbox row of an event id a second time, as a relay that crashed after sending would ($1 event id). */
export const DUPLICATE_OUTBOX_ROW = sql`INSERT INTO event_outbox (event_id, event_name, topic, message_key, envelope, created_at)
    SELECT event_id, event_name, topic, message_key, envelope, created_at FROM event_outbox WHERE event_id = $1 ORDER BY id LIMIT 1`
