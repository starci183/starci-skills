import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Creates the recurrence rules and occurrences tables. The task fields of an occurrence live on the tasks table and the
 * occurrence id is the id of that task; the window key is unique across all rules, so generating a window twice collides
 * instead of writing a second row.
 */
export class CreateRecurTables1758246000001 implements MigrationInterface {
    name = "CreateRecurTables1758246000001"

    /** Creates both tables and their indexes. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS recurrence_rules (
    id text PRIMARY KEY,
    owner text NOT NULL,
    title text NOT NULL,
    frequency text NOT NULL,
    n integer,
    day_of_month integer,
    time_zone text NOT NULL,
    time text NOT NULL,
    start_date text NOT NULL,
    ended_at text
)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS recurrence_rules_owner_idx ON recurrence_rules (owner)`)
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS occurrences (
    id text PRIMARY KEY,
    rule_id text NOT NULL,
    window_key text NOT NULL,
    local_date text NOT NULL,
    due_at_utc timestamptz NOT NULL,
    status text NOT NULL
)`)
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS occurrences_window_key_key ON occurrences (window_key)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS occurrences_rule_id_idx ON occurrences (rule_id)`)
    }

    /** Drops both tables. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS occurrences`)
        await queryRunner.query(`DROP TABLE IF EXISTS recurrence_rules`)
    }
}
