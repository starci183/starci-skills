import {
    MigrationInterface, QueryRunner 
} from "typeorm"

/**
 * data.recur.rule and data.recur.occurrence own these two tables. `recurrence_rules` is the rule itself
 * (data.recur.rule's fields exactly); `occurrences` is the "plus your own occurrence row" half of
 * data.recur.occurrence - the base task fields (id, owner, title, complete, completedAt) already live on
 * `tasks` (created through the same `CreateTaskCommand` every task uses), and `id` here is that same
 * task id, not a foreign key to a different row. `window_key` is unique across every occurrence of every
 * rule (decision.recur.occurrence.identity), which is what makes generation idempotent
 * (br.recur.generation.once) - a second materialise attempt for the same rule id + local date collides
 * on this constraint instead of writing a second row.
 */
export class CreateRecurTables1758246000000 implements MigrationInterface {
    name = "CreateRecurTables1758246000000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recurrence_rules (
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
      )
    `)
        await queryRunner.query("CREATE INDEX IF NOT EXISTS recurrence_rules_owner_idx ON recurrence_rules (owner)")

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS occurrences (
        id text PRIMARY KEY,
        rule_id text NOT NULL,
        window_key text NOT NULL,
        local_date text NOT NULL,
        due_at_utc timestamptz NOT NULL,
        status text NOT NULL
      )
    `)
        await queryRunner.query(
            "CREATE UNIQUE INDEX IF NOT EXISTS occurrences_window_key_key ON occurrences (window_key)",
        )
        await queryRunner.query("CREATE INDEX IF NOT EXISTS occurrences_rule_id_idx ON occurrences (rule_id)")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE IF EXISTS occurrences")
        await queryRunner.query("DROP TABLE IF EXISTS recurrence_rules")
    }
}
