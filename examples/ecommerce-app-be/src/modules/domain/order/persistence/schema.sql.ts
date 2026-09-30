import { sql } from "@modules/platform/database"

/** Creates the orders table. */
export const CREATE_ORDERS_TABLE = sql`CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('confirmed')),
    total_minor_units int NOT NULL CHECK (total_minor_units >= 0),
    currency varchar(3) NOT NULL,
    idempotency_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_orders_person_idempotency UNIQUE (person_id, idempotency_key)
)`

/** Creates the order_lines table. */
export const CREATE_ORDER_LINES_TABLE = sql`CREATE TABLE order_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id),
    product_id text NOT NULL,
    quantity int NOT NULL CHECK (quantity > 0),
    unit_price_minor_units int NOT NULL CHECK (unit_price_minor_units >= 0)
)`

/** Drops the order_lines table. */
export const DROP_ORDER_LINES_TABLE = sql`DROP TABLE order_lines`

/** Drops the orders table. */
export const DROP_ORDERS_TABLE = sql`DROP TABLE orders`
