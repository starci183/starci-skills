import type { MigrationInterface, QueryRunner } from "typeorm"
import {
    CREATE_DELIVERY_ATTEMPTS_STATE_INDEX,
    CREATE_DELIVERY_ATTEMPTS_TABLE,
    CREATE_DIGEST_WINDOWS_OPEN_INDEX,
    CREATE_DIGEST_WINDOWS_TABLE,
    CREATE_NOTIFICATIONS_GROUP_INDEX,
    CREATE_NOTIFICATIONS_RECIPIENT_INDEX,
    CREATE_NOTIFICATIONS_TABLE,
    CREATE_PREFERENCES_TABLE,
    DROP_DELIVERY_ATTEMPTS_TABLE,
    DROP_DIGEST_WINDOWS_TABLE,
    DROP_NOTIFICATIONS_TABLE,
    DROP_PREFERENCES_TABLE,
} from "../schema.sql"

/** Creates the notification, delivery attempt, preference and digest window tables; every statement is idempotent. */
export class CreateNotifyTables1758210000000 implements MigrationInterface {
    name = "CreateNotifyTables1758210000000"

    /** Creates the four tables and their indexes. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_NOTIFICATIONS_TABLE)
        await queryRunner.query(CREATE_NOTIFICATIONS_RECIPIENT_INDEX)
        await queryRunner.query(CREATE_NOTIFICATIONS_GROUP_INDEX)
        await queryRunner.query(CREATE_DELIVERY_ATTEMPTS_TABLE)
        await queryRunner.query(CREATE_DELIVERY_ATTEMPTS_STATE_INDEX)
        await queryRunner.query(CREATE_PREFERENCES_TABLE)
        await queryRunner.query(CREATE_DIGEST_WINDOWS_TABLE)
        await queryRunner.query(CREATE_DIGEST_WINDOWS_OPEN_INDEX)
    }

    /** Drops the four tables, dependents first. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_DIGEST_WINDOWS_TABLE)
        await queryRunner.query(DROP_PREFERENCES_TABLE)
        await queryRunner.query(DROP_DELIVERY_ATTEMPTS_TABLE)
        await queryRunner.query(DROP_NOTIFICATIONS_TABLE)
    }
}
