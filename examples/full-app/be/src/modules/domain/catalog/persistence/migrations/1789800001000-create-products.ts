import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the products table of the order database. */
export class CreateProducts1789800001000 implements MigrationInterface {
    name = "CreateProducts1789800001000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE products (
    id text PRIMARY KEY,
    name text NOT NULL,
    price_minor_units int NOT NULL CHECK (price_minor_units >= 0),
    stock int NOT NULL CHECK (stock >= 0)
)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE products`)
    }
}
