import { sql } from "@modules/platform/database"

/** Creates the cart_items table. */
export const CREATE_CART_ITEMS_TABLE = sql`CREATE TABLE cart_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    product_id text NOT NULL,
    quantity int NOT NULL CHECK (quantity > 0),
    CONSTRAINT uq_cart_items_person_product UNIQUE (person_id, product_id)
)`

/** Drops the cart_items table. */
export const DROP_CART_ITEMS_TABLE = sql`DROP TABLE cart_items`
