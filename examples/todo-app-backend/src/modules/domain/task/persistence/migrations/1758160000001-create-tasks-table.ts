import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Creates the tasks table. The dev seed already creates a narrower table on a fresh container, so every statement is
 * idempotent and this migration only adds what the seed lacks.
 */
export class CreateTasksTable1758160000001 implements MigrationInterface {
    name = "CreateTasksTable1758160000001"

    /** Creates the table, the completion instant and the owner index. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS tasks (
    id text PRIMARY KEY,
    owner text NOT NULL,
    title text NOT NULL,
    complete boolean NOT NULL DEFAULT false
)`)
        await queryRunner.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks (owner)`)
    }

    /** Drops the completion instant. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS completed_at`)
    }
}
