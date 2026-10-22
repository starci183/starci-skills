import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the orders and order_lines tables of the order database. */
export class CreateOrders1789800003000 implements MigrationInterface {
    name = "CreateOrders1789800003000"

    /** Creates the tables. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('pending')),
    total_minor_units int NOT NULL CHECK (total_minor_units >= 0),
    currency varchar(3) NOT NULL,
    idempotency_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_orders_person_idempotency UNIQUE (person_id, idempotency_key)
)`)
        await queryRunner.query(`CREATE TABLE order_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id),
    product_id text NOT NULL,
    quantity int NOT NULL CHECK (quantity > 0),
    unit_price_minor_units int NOT NULL CHECK (unit_price_minor_units >= 0)
)`)
    }

    /** Drops the tables, lines first. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE order_lines`)
        await queryRunner.query(`DROP TABLE orders`)
    }
}
