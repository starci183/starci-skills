import {
    MigrationInterface, QueryRunner 
} from "typeorm"

/**
 * data.upload.upload owns this table. The dev seed (.starcistacks/dev/seeds/30-upload.sql) already
 * creates the same `uploads` table on a fresh container so a first boot has the shape before the app
 * ever runs a migration; this migration is idempotent so it agrees with that table instead of fighting
 * it - the same belt-and-braces agreement 1758160000001-create-tasks-table documents for `tasks`.
 */
export class CreateUploadsTable1758300000000 implements MigrationInterface {
    name = "CreateUploadsTable1758300000000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id text PRIMARY KEY,
        owner text NOT NULL,
        task_id text,
        filename text NOT NULL,
        mime text NOT NULL,
        size_bytes integer NOT NULL,
        storage_key text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL
      )
    `)
        await queryRunner.query("CREATE INDEX IF NOT EXISTS uploads_owner_idx ON uploads (owner)")
        await queryRunner.query("CREATE INDEX IF NOT EXISTS uploads_task_id_idx ON uploads (task_id)")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE IF EXISTS uploads")
    }
}
