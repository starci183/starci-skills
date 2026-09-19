import {
    MigrationInterface, QueryRunner 
} from "typeorm"

/**
 * sds.login.session-store owns this table: one row per live session, deleted outright on expiry or
 * revoke rather than soft-deleted, so "the row is gone" is a literal fact a later read can trust.
 */
export class CreateSessionsTable1758160000000 implements MigrationInterface {
    name = "CreateSessionsTable1758160000000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token text PRIMARY KEY,
        person_id text NOT NULL,
        issued_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL
      )
    `)
        await queryRunner.query("CREATE INDEX IF NOT EXISTS sessions_person_id_idx ON sessions (person_id)")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE IF EXISTS sessions")
    }
}
