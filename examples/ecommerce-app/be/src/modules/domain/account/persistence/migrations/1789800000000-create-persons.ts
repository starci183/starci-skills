import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the persons table of the identity database. */
export class CreatePersons1789800000000 implements MigrationInterface {
    name = "CreatePersons1789800000000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE persons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE persons`)
    }
}
