import type { MigrationInterface, QueryRunner } from "typeorm"
import {
    CREATE_OCCURRENCES_RULE_INDEX,
    CREATE_OCCURRENCES_TABLE,
    CREATE_OCCURRENCES_WINDOW_KEY_INDEX,
    CREATE_RECURRENCE_RULES_OWNER_INDEX,
    CREATE_RECURRENCE_RULES_TABLE,
    DROP_OCCURRENCES_TABLE,
    DROP_RECURRENCE_RULES_TABLE,
} from "../schema.sql"

/**
 * Creates the recurrence rules and occurrences tables. The task fields of an occurrence live on the tasks table and the
 * occurrence id is the id of that task; the window key is unique across all rules, so generating a window twice collides
 * instead of writing a second row.
 */
export class CreateRecurTables1758246000001 implements MigrationInterface {
    name = "CreateRecurTables1758246000001"

    /** Creates both tables and their indexes. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_RECURRENCE_RULES_TABLE)
        await queryRunner.query(CREATE_RECURRENCE_RULES_OWNER_INDEX)
        await queryRunner.query(CREATE_OCCURRENCES_TABLE)
        await queryRunner.query(CREATE_OCCURRENCES_WINDOW_KEY_INDEX)
        await queryRunner.query(CREATE_OCCURRENCES_RULE_INDEX)
    }

    /** Drops both tables. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_OCCURRENCES_TABLE)
        await queryRunner.query(DROP_RECURRENCE_RULES_TABLE)
    }
}
