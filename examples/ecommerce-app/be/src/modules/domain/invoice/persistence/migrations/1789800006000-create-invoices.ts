import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the invoices table of the billing database. */
export class CreateInvoices1789800006000 implements MigrationInterface {
    name = "CreateInvoices1789800006000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL UNIQUE,
    person_id uuid NOT NULL,
    total_minor_units int NOT NULL CHECK (total_minor_units >= 0),
    status varchar(16) NOT NULL CHECK (status IN ('issued', 'rejected', 'paid')),
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz
)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE invoices`)
    }
}
