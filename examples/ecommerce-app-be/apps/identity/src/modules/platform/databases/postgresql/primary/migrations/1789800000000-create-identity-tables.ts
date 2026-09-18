import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the identity schema's one table and seeds the DEMO-ONLY person the live proof signs in
 * as (demo@ecommerce.dev / ecommerce-demo, scrypt hex with the fixed demo salt
 * "ecommerce-app-demo"). Idempotent: the table is created if absent and the demo row only inserts
 * when missing, so re-running the migration set against an existing database is a no-op.
 */
export class CreateIdentityTables1789800000000 implements MigrationInterface {
  name = 'CreateIdentityTables1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS identity_person (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      INSERT INTO identity_person (email, password_hash)
      SELECT 'demo@ecommerce.dev',
             '2c2c5a95489cece045d979a708a5541a77446d9563e6fb2749d5d2c744a091e70d1e39c55cd3609b1886a9ba96e6cdee60b5a0e4373f492e09c2860dbd8f895a'
      WHERE NOT EXISTS (SELECT 1 FROM identity_person WHERE email = 'demo@ecommerce.dev')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS identity_person');
  }
}
