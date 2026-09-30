import type { MigrationInterface, QueryRunner } from "typeorm"
import {
    CREATE_PAYMENT_INTENTS_GATEWAY_INDEX,
    CREATE_PAYMENT_INTENTS_SUBSCRIPTION_INDEX,
    CREATE_PAYMENT_INTENTS_TABLE,
    CREATE_SUBSCRIPTIONS_PERSON_INDEX,
    CREATE_SUBSCRIPTIONS_TABLE,
    DROP_PAYMENT_INTENTS_TABLE,
    DROP_SUBSCRIPTIONS_TABLE,
} from "../schema.sql"

/** Creates the subscriptions and payment intents tables; every statement is idempotent so a seeded database agrees with it. */
export class CreatePlanTables1758160000003 implements MigrationInterface {
    name = "CreatePlanTables1758160000003"

    /** Creates both tables and their indexes. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_SUBSCRIPTIONS_TABLE)
        await queryRunner.query(CREATE_SUBSCRIPTIONS_PERSON_INDEX)
        await queryRunner.query(CREATE_PAYMENT_INTENTS_TABLE)
        await queryRunner.query(CREATE_PAYMENT_INTENTS_SUBSCRIPTION_INDEX)
        await queryRunner.query(CREATE_PAYMENT_INTENTS_GATEWAY_INDEX)
    }

    /** Drops both tables. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_PAYMENT_INTENTS_TABLE)
        await queryRunner.query(DROP_SUBSCRIPTIONS_TABLE)
    }
}
