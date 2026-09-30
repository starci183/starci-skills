import type { MigrationInterface, QueryRunner } from "typeorm"
import { CREATE_ORDER_LINES_TABLE, CREATE_ORDERS_TABLE, DROP_ORDER_LINES_TABLE, DROP_ORDERS_TABLE } from "../schema.sql"

/** Creates the orders and order_lines tables of the order database. */
export class CreateOrders1789800003000 implements MigrationInterface {
    name = "CreateOrders1789800003000"

    /** Creates the tables. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_ORDERS_TABLE)
        await queryRunner.query(CREATE_ORDER_LINES_TABLE)
    }

    /** Drops the tables, lines first. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_ORDER_LINES_TABLE)
        await queryRunner.query(DROP_ORDERS_TABLE)
    }
}
