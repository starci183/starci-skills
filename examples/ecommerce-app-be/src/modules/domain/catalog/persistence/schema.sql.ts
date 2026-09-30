import { sql } from "@modules/platform/database"

/** Creates the products table. */
export const CREATE_PRODUCTS_TABLE = sql`CREATE TABLE products (
    id text PRIMARY KEY,
    name text NOT NULL,
    price_minor_units int NOT NULL CHECK (price_minor_units >= 0),
    stock int NOT NULL CHECK (stock >= 0)
)`

/** Drops the products table. */
export const DROP_PRODUCTS_TABLE = sql`DROP TABLE products`
