import {
    MigrationInterface, QueryRunner 
} from "typeorm"

/**
 * Creates the order schema and seeds the demo catalog. Idempotent (CREATE TABLE IF NOT EXISTS,
 * ON CONFLICT DO NOTHING) so a fresh environment is usable without a separate seed step.
 */
export class CreateOrderTables1789800001000 implements MigrationInterface {
    name = "CreateOrderTables1789800001000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product (
        id text PRIMARY KEY,
        name text NOT NULL,
        price_minor_units int NOT NULL,
        stock int NOT NULL
      )
    `)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cart_item (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id uuid NOT NULL,
        product_id text NOT NULL REFERENCES product(id),
        quantity int NOT NULL CHECK (quantity > 0),
        CONSTRAINT uq_cart_item_person_product UNIQUE (person_id, product_id)
      )
    `)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sales_order (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id uuid NOT NULL,
        status text NOT NULL DEFAULT 'confirmed',
        total_minor_units int NOT NULL,
        currency text NOT NULL DEFAULT 'USD',
        idempotency_key text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_sales_order_idempotency UNIQUE (person_id, idempotency_key)
      )
    `)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sales_order_line (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES sales_order(id),
        product_id text NOT NULL REFERENCES product(id),
        quantity int NOT NULL,
        unit_price_minor_units int NOT NULL
      )
    `)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id uuid NOT NULL,
        order_id uuid NOT NULL REFERENCES sales_order(id),
        amount_minor_units int NOT NULL,
        status text NOT NULL DEFAULT 'captured',
        idempotency_key text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
        await queryRunner.query(`
      INSERT INTO product (id, name, price_minor_units, stock) VALUES
        ('sku-mug', 'Enamel mug', 1299, 40),
        ('sku-notebook', 'Dot-grid notebook', 899, 25),
        ('sku-thermos', 'Steel thermos', 2499, 2)
      ON CONFLICT (id) DO NOTHING
    `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE IF EXISTS payment")
        await queryRunner.query("DROP TABLE IF EXISTS sales_order_line")
        await queryRunner.query("DROP TABLE IF EXISTS sales_order")
        await queryRunner.query("DROP TABLE IF EXISTS cart_item")
        await queryRunner.query("DROP TABLE IF EXISTS product")
    }
}
