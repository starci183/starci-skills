import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * data.audit.log-line, data.audit.erasure-request and decision.audit.erasure-method's keystore own these
 * three tables. `todo_audit` is this lane's own database (never the shared `todo` database other
 * examples' migrations run against), so no seed conflict is possible - this is the first migration to
 * run against a fresh container.
 *
 * `audit_log_lines.id` is a bigserial: the chain's own ordering key, independent of `at`, so
 * ac.audit.append-only.chain-detects-tamper can report an exact break position even when two lines share
 * a capture timestamp. `audit_keys.person_id` is the primary key (one row per subject); `key_id` is
 * unique so a log line's `key_id` never ambiguously resolves to more than one key. `audit_erasure_requests
 * .person_id` is nullable because AuditErasureService.tComplete sets it to null once a request reaches
 * `complete` (data.audit.erasure-request's own invariant).
 */
export class CreateAuditTables1758246000000 implements MigrationInterface {
  name = 'CreateAuditTables1758246000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_log_lines (
        id bigserial PRIMARY KEY,
        at timestamptz NOT NULL,
        action text NOT NULL,
        target text,
        key_id text NOT NULL,
        actor text NOT NULL,
        prev_hash text NOT NULL,
        hash text NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS audit_log_lines_key_id_idx ON audit_log_lines (key_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_keys (
        person_id text PRIMARY KEY,
        key_id text NOT NULL UNIQUE,
        key text NOT NULL,
        created_at timestamptz NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_erasure_requests (
        request_id text PRIMARY KEY,
        person_id text,
        state text NOT NULL,
        requested_at timestamptz NOT NULL,
        verified_at timestamptz,
        refused_at timestamptz,
        executing_at timestamptz,
        completed_at timestamptz
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_erasure_requests`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_keys`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log_lines`);
  }
}
