import type { MigrationInterface, QueryRunner } from "typeorm"

/** Lets an order be paid and cancelled: the payment a bank transfer records and the compensation of a rejected invoice. */
export class AddOrderCancellation1789800007000 implements MigrationInterface {
    name = "AddOrderCancellation1789800007000"

    /** Widens the status check of orders. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE orders DROP CONSTRAINT orders_status_check`)
        await queryRunner.query(
            `ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'paid', 'cancelled'))`,
        )
    }

    /** Restores the narrow check; every paid and cancelled order must be gone first. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE orders DROP CONSTRAINT orders_status_check`)
        await queryRunner.query(`ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending'))`)
    }
}
