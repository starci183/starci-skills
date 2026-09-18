import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * data.plan.subscription and data.plan.payment-intent own these two tables. Idempotent (IF NOT EXISTS
 * throughout), matching the house convention set by 1758160000001-create-tasks-table.ts, so this
 * migration agrees with a fresh container's seed rather than fighting it.
 */
export class CreatePlanTables1758160000002 implements MigrationInterface {
  name = 'CreatePlanTables1758160000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id text PRIMARY KEY,
        person_id text NOT NULL UNIQUE,
        plan text NOT NULL DEFAULT 'free',
        status text NOT NULL DEFAULT 'free',
        period_end timestamptz,
        gateway_customer_id text
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS subscriptions_person_id_idx ON subscriptions (person_id)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payment_intents (
        id text PRIMARY KEY,
        subscription_id text NOT NULL,
        gateway text NOT NULL DEFAULT 'sepay',
        gateway_intent_id text NOT NULL,
        amount integer NOT NULL,
        currency text NOT NULL DEFAULT 'VND',
        status text NOT NULL DEFAULT 'pending',
        applied_at timestamptz
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS payment_intents_subscription_id_idx ON payment_intents (subscription_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS payment_intents_gateway_intent_id_idx ON payment_intents (gateway_intent_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS payment_intents`);
    await queryRunner.query(`DROP TABLE IF EXISTS subscriptions`);
  }
}
