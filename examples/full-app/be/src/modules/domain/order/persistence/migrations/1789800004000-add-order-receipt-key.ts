import type { MigrationInterface, QueryRunner } from "typeorm"

/** Adds the object key of an order's archived receipt; null until the receipt is stored. */
export class AddOrderReceiptKey1789800004000 implements MigrationInterface {
    name = "AddOrderReceiptKey1789800004000"

    /** Adds the column. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE orders ADD COLUMN receipt_key text`)
    }

    /** Drops the column. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE orders DROP COLUMN receipt_key`)
    }
}
