import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the uploads table: one metadata row per object, deleted with its object. */
export class CreateUploadsTable1758300000000 implements MigrationInterface {
    name = "CreateUploadsTable1758300000000"

    /** Creates the table and its owner and task indexes. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS uploads (
    id text PRIMARY KEY,
    owner text NOT NULL,
    task_id text,
    filename text NOT NULL,
    mime text NOT NULL,
    size_bytes integer NOT NULL,
    storage_key text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL
)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS uploads_owner_idx ON uploads (owner)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS uploads_task_id_idx ON uploads (task_id)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS uploads`)
    }
}
