import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the sessions table: one row per live session, deleted outright on revoke or purge. */
export class CreateSessionsTable1758160000000 implements MigrationInterface {
    name = "CreateSessionsTable1758160000000"

    /** Creates the table and its person index. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS sessions (
    token text PRIMARY KEY,
    person_id text NOT NULL,
    issued_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL
)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS sessions_person_id_idx ON sessions (person_id)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS sessions`)
    }
}
