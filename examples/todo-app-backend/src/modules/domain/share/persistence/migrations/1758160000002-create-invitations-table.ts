import type { MigrationInterface, QueryRunner } from "typeorm"
import {
    CREATE_INVITATIONS_PERSON_INDEX,
    CREATE_INVITATIONS_TABLE,
    CREATE_INVITATIONS_TASK_EMAIL_INDEX,
    CREATE_INVITATIONS_TASK_INDEX,
    DROP_INVITATIONS_TABLE,
} from "../schema.sql"

/**
 * Creates the invitations table. The unique index on (task_id, email) backs the rule that exactly one row exists per
 * pair: inviting again re-opens the existing row instead of inserting a second one.
 */
export class CreateInvitationsTable1758160000002 implements MigrationInterface {
    name = "CreateInvitationsTable1758160000002"

    /** Creates the table and its indexes. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_INVITATIONS_TABLE)
        await queryRunner.query(CREATE_INVITATIONS_TASK_EMAIL_INDEX)
        await queryRunner.query(CREATE_INVITATIONS_TASK_INDEX)
        await queryRunner.query(CREATE_INVITATIONS_PERSON_INDEX)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_INVITATIONS_TABLE)
    }
}
