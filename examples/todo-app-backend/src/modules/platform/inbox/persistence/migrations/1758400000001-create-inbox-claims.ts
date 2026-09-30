import type { MigrationInterface, QueryRunner } from "typeorm"
import { CREATE_INBOX_CLAIMS_TABLE, DROP_INBOX_CLAIMS_TABLE } from "../schema.sql"

/** Creates the table the inbox claims events in. */
export class CreateInboxClaims1758400000001 implements MigrationInterface {
    name = "CreateInboxClaims1758400000001"

    /** Creates the claims table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_INBOX_CLAIMS_TABLE)
    }

    /** Drops the claims table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_INBOX_CLAIMS_TABLE)
    }
}
