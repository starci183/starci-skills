import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * data.task.task owns this table. The dev seed (.starcistacks/dev/seeds/01-schema.sql) already creates a
 * narrower `tasks` table on a fresh container so a first boot has a seeded row before the app ever runs a
 * migration; this migration is idempotent so it agrees with that table instead of fighting it, and it adds
 * the one column the seed does not: completed_at, set if and only if complete is true.
 */
export class CreateTasksTable1758160000001 implements MigrationInterface {
  name = 'CreateTasksTable1758160000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id text PRIMARY KEY,
        owner text NOT NULL,
        title text NOT NULL,
        complete boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks (owner)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS completed_at`);
  }
}
