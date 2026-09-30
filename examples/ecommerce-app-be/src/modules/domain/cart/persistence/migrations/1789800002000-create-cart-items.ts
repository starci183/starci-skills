import type { MigrationInterface, QueryRunner } from "typeorm"
import { CREATE_CART_ITEMS_TABLE, DROP_CART_ITEMS_TABLE } from "../schema.sql"

/** Creates the cart_items table of the order database. */
export class CreateCartItems1789800002000 implements MigrationInterface {
    name = "CreateCartItems1789800002000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_CART_ITEMS_TABLE)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_CART_ITEMS_TABLE)
    }
}
