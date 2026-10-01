import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the cart_items table of the order database. */
export class CreateCartItems1789800002000 implements MigrationInterface {
    name = "CreateCartItems1789800002000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE cart_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    product_id text NOT NULL,
    quantity int NOT NULL CHECK (quantity > 0),
    CONSTRAINT uq_cart_items_person_product UNIQUE (person_id, product_id)
)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE cart_items`)
    }
}
