import type { MigrationInterface, QueryRunner } from "typeorm"
import { CREATE_OUTBOX_DUE_INDEX, CREATE_OUTBOX_MESSAGES_TABLE, DROP_OUTBOX_MESSAGES_TABLE } from "../schema.sql"

/** Creates the table durable messages are written to. */
export class CreateOutboxMessages1758400000002 implements MigrationInterface {
    name = "CreateOutboxMessages1758400000002"

    /** Creates the table and its due index. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_OUTBOX_MESSAGES_TABLE)
        await queryRunner.query(CREATE_OUTBOX_DUE_INDEX)
    }

    /** Drops the table with its index. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_OUTBOX_MESSAGES_TABLE)
    }
}
