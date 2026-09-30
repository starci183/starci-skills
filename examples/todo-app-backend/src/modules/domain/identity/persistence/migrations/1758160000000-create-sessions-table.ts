import type { MigrationInterface, QueryRunner } from "typeorm"
import { CREATE_SESSIONS_PERSON_INDEX, CREATE_SESSIONS_TABLE, DROP_SESSIONS_TABLE } from "../schema.sql"

/** Creates the sessions table: one row per live session, deleted outright on revoke or purge. */
export class CreateSessionsTable1758160000000 implements MigrationInterface {
    name = "CreateSessionsTable1758160000000"

    /** Creates the table and its person index. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_SESSIONS_TABLE)
        await queryRunner.query(CREATE_SESSIONS_PERSON_INDEX)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_SESSIONS_TABLE)
    }
}
