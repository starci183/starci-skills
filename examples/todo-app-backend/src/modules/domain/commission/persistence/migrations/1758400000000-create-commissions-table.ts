import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the commissions table; every statement is idempotent so a seeded database agrees with it. */
export class CreateCommissionsTable1758400000000 implements MigrationInterface {
    name = "CreateCommissionsTable1758400000000"

    /** Creates the table and its index. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS commissions (
    id text PRIMARY KEY,
    referrer_id text NOT NULL,
    buyer_id text NOT NULL,
    payment_id text NOT NULL UNIQUE,
    amount integer NOT NULL,
    accrued_at timestamptz NOT NULL
)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS commissions_referrer_id_idx ON commissions (referrer_id)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS commissions`)
    }
}
