import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Creates the three audit tables: the append-only log (its bigserial id is the chain position, independent of the
 * capture instant), the keystore (one key per person, the key id unique) and the erasure requests (person_id nullable
 * because a completed request drops it).
 */
export class CreateAuditTables1758246000000 implements MigrationInterface {
    name = "CreateAuditTables1758246000000"

    /** Creates the tables and the key index. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS audit_log_lines (
    id bigserial PRIMARY KEY,
    at timestamptz NOT NULL,
    action text NOT NULL,
    target text,
    key_id text NOT NULL,
    actor text NOT NULL,
    prev_hash text NOT NULL,
    hash text NOT NULL
)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS audit_log_lines_key_id_idx ON audit_log_lines (key_id)`)
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS audit_keys (
    person_id text PRIMARY KEY,
    key_id text NOT NULL UNIQUE,
    key text NOT NULL,
    created_at timestamptz NOT NULL
)`)
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS audit_erasure_requests (
    request_id text PRIMARY KEY,
    person_id text,
    state text NOT NULL,
    requested_at timestamptz NOT NULL,
    verified_at timestamptz,
    refused_at timestamptz,
    executing_at timestamptz,
    completed_at timestamptz
)`)
    }

    /** Drops the tables. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS audit_erasure_requests`)
        await queryRunner.query(`DROP TABLE IF EXISTS audit_keys`)
        await queryRunner.query(`DROP TABLE IF EXISTS audit_log_lines`)
    }
}
