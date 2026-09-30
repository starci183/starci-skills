import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Creates the invitations table. The unique index on (task_id, email) backs the rule that exactly one row exists per
 * pair: inviting again re-opens the existing row instead of inserting a second one.
 */
export class CreateInvitationsTable1758160000002 implements MigrationInterface {
    name = "CreateInvitationsTable1758160000002"

    /** Creates the table and its indexes. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS invitations (
    id text PRIMARY KEY,
    task_id text NOT NULL,
    owner_id text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    sent_at timestamptz NOT NULL,
    accepted_at timestamptz,
    revoked_at timestamptz,
    person_id text
)`)
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS invitations_task_email_idx ON invitations (task_id, email)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS invitations_task_idx ON invitations (task_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS invitations_person_idx ON invitations (person_id)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS invitations`)
    }
}
