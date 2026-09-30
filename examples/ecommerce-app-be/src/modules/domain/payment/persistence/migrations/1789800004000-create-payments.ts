import type { MigrationInterface, QueryRunner } from "typeorm"
import { CREATE_PAYMENTS_TABLE, DROP_PAYMENTS_TABLE } from "../schema.sql"

/** Creates the payments table of the order database. */
export class CreatePayments1789800004000 implements MigrationInterface {
    name = "CreatePayments1789800004000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_PAYMENTS_TABLE)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_PAYMENTS_TABLE)
    }
}
