import type { MigrationInterface, QueryRunner } from "typeorm"
import { CREATE_PRODUCTS_TABLE, DROP_PRODUCTS_TABLE } from "../schema.sql"

/** Creates the products table of the order database. */
export class CreateProducts1789800001000 implements MigrationInterface {
    name = "CreateProducts1789800001000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_PRODUCTS_TABLE)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_PRODUCTS_TABLE)
    }
}
