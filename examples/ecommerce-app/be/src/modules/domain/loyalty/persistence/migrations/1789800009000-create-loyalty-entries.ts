import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the loyalty_entries table of the order database. */
export class CreateLoyaltyEntries1789800009000 implements MigrationInterface {
    name = "CreateLoyaltyEntries1789800009000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE loyalty_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    order_id uuid NOT NULL UNIQUE,
    points int NOT NULL CHECK (points > 0),
    created_at timestamptz NOT NULL DEFAULT now()
)`)
        await queryRunner.query(`CREATE INDEX loyalty_entries_person_idx ON loyalty_entries (person_id)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE loyalty_entries`)
    }
}
