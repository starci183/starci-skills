import type { MigrationInterface, QueryRunner } from "typeorm"

/** Gives orders the payment lifecycle: pending until a bank transfer pays them or they expire, and the instant they were paid. */
export class AddOrderPaymentLifecycle1789800010000 implements MigrationInterface {
    name = "AddOrderPaymentLifecycle1789800010000"

    /** Widens the status check and adds the paid-at column. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE orders DROP CONSTRAINT orders_status_check`)
        await queryRunner.query(
            `ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'paid', 'expired', 'cancelled'))`,
        )
        await queryRunner.query(`ALTER TABLE orders ADD COLUMN paid_at timestamptz`)
        await queryRunner.query(`CREATE INDEX orders_pending_created_idx ON orders (created_at) WHERE status = 'pending'`)
    }

    /** Removes the column and restores the previous check. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX orders_pending_created_idx`)
        await queryRunner.query(`ALTER TABLE orders DROP COLUMN paid_at`)
        await queryRunner.query(`ALTER TABLE orders DROP CONSTRAINT orders_status_check`)
        await queryRunner.query(`ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'paid', 'cancelled'))`)
    }
}
