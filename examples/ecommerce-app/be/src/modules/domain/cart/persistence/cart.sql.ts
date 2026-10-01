import { sql } from "@modules/platform/database"

/** Adds a product to a cart, accumulating the quantity when the line exists ($1 person, $2 product, $3 quantity); answers the merged line. */
export const UPSERT_CART_ITEM = sql`INSERT INTO cart_items (person_id, product_id, quantity) VALUES ($1, $2, $3)
    ON CONFLICT (person_id, product_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
    RETURNING product_id, quantity`
