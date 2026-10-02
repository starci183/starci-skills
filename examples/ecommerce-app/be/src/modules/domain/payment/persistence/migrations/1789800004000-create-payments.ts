import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the payments table of the billing database. */
export class CreatePayments1789800004000 implements MigrationInterface {
    name = "CreatePayments1789800004000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL,
    order_id uuid NOT NULL UNIQUE,
    person_id uuid NOT NULL,
    amount_minor_units int NOT NULL CHECK (amount_minor_units >= 0),
    provider_reference varchar(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE payments`)
    }
}
