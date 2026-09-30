import type { MigrationInterface, QueryRunner } from "typeorm"
import {
    ADD_TASKS_COMPLETED_AT,
    CREATE_TASKS_OWNER_INDEX,
    CREATE_TASKS_TABLE,
    DROP_TASKS_COMPLETED_AT,
} from "../schema.sql"

/**
 * Creates the tasks table. The dev seed already creates a narrower table on a fresh container, so every statement is
 * idempotent and this migration only adds what the seed lacks.
 */
export class CreateTasksTable1758160000001 implements MigrationInterface {
    name = "CreateTasksTable1758160000001"

    /** Creates the table, the completion instant and the owner index. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_TASKS_TABLE)
        await queryRunner.query(ADD_TASKS_COMPLETED_AT)
        await queryRunner.query(CREATE_TASKS_OWNER_INDEX)
    }

    /** Drops the completion instant. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_TASKS_COMPLETED_AT)
    }
}
