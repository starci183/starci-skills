import type { MigrationInterface, QueryRunner } from "typeorm"
import {
    CREATE_UPLOADS_OWNER_INDEX,
    CREATE_UPLOADS_TABLE,
    CREATE_UPLOADS_TASK_INDEX,
    DROP_UPLOADS_TABLE,
} from "../schema.sql"

/** Creates the uploads table: one metadata row per object, deleted with its object. */
export class CreateUploadsTable1758300000000 implements MigrationInterface {
    name = "CreateUploadsTable1758300000000"

    /** Creates the table and its owner and task indexes. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_UPLOADS_TABLE)
        await queryRunner.query(CREATE_UPLOADS_OWNER_INDEX)
        await queryRunner.query(CREATE_UPLOADS_TASK_INDEX)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_UPLOADS_TABLE)
    }
}
