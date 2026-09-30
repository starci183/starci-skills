import type { MigrationInterface, QueryRunner } from "typeorm"
import {
    CREATE_AUDIT_ERASURE_REQUESTS_TABLE,
    CREATE_AUDIT_KEYS_TABLE,
    CREATE_AUDIT_LOG_LINES_KEY_INDEX,
    CREATE_AUDIT_LOG_LINES_TABLE,
    DROP_AUDIT_ERASURE_REQUESTS_TABLE,
    DROP_AUDIT_KEYS_TABLE,
    DROP_AUDIT_LOG_LINES_TABLE,
} from "../schema.sql"

/**
 * Creates the three audit tables: the append-only log (its bigserial id is the chain position, independent of the
 * capture instant), the keystore (one key per person, the key id unique) and the erasure requests (person_id nullable
 * because a completed request drops it).
 */
export class CreateAuditTables1758246000000 implements MigrationInterface {
    name = "CreateAuditTables1758246000000"

    /** Creates the tables and the key index. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_AUDIT_LOG_LINES_TABLE)
        await queryRunner.query(CREATE_AUDIT_LOG_LINES_KEY_INDEX)
        await queryRunner.query(CREATE_AUDIT_KEYS_TABLE)
        await queryRunner.query(CREATE_AUDIT_ERASURE_REQUESTS_TABLE)
    }

    /** Drops the tables. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_AUDIT_ERASURE_REQUESTS_TABLE)
        await queryRunner.query(DROP_AUDIT_KEYS_TABLE)
        await queryRunner.query(DROP_AUDIT_LOG_LINES_TABLE)
    }
}
