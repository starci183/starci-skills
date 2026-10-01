import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the payments table of the order database. */
export class CreatePayments1789800004000 implements MigrationInterface {
    name = "CreatePayments1789800004000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    order_id uuid NOT NULL UNIQUE,
    amount_minor_units int NOT NULL CHECK (amount_minor_units >= 0),
    status varchar(16) NOT NULL CHECK (status IN ('captured')),
    created_at timestamptz NOT NULL DEFAULT now()
)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE payments`)
    }
}
