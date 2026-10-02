import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the notes table of the primary database. */
export class InitNote1790000000000 implements MigrationInterface {
    name = "InitNote1790000000000"

    /** Creates the table and the index the newest-first list reads. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    body text NOT NULL CHECK (char_length(body) > 0),
    created_at timestamptz NOT NULL
)`)
        await queryRunner.query(`CREATE INDEX ix_notes_created_at ON notes (created_at DESC)`)
    }

    /** Drops the index and the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX ix_notes_created_at`)
        await queryRunner.query(`DROP TABLE notes`)
    }
}
