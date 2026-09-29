import {
    MigrationInterface, QueryRunner 
} from "typeorm"

/**
 * data.share.invitation owns this table. A unique index on (task_id, email) backs the invariant "exactly
 * one row exists per (taskId, email) pair at a time" - InvitationService.invite reuses the existing row
 * (re-opening it as pending) instead of inserting a second one for the same pair.
 */
export class CreateInvitationsTable1758160000002 implements MigrationInterface {
    name = "CreateInvitationsTable1758160000002"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS invitations (
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
      )
    `)
        await queryRunner.query("CREATE UNIQUE INDEX IF NOT EXISTS invitations_task_email_idx ON invitations (task_id, email)")
        await queryRunner.query("CREATE INDEX IF NOT EXISTS invitations_task_idx ON invitations (task_id)")
        await queryRunner.query("CREATE INDEX IF NOT EXISTS invitations_person_idx ON invitations (person_id)")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE IF EXISTS invitations")
    }
}
