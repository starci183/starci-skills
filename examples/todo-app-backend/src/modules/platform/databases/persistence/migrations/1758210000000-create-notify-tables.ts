import {
    MigrationInterface, QueryRunner 
} from "typeorm"

/**
 * data.notify.notification, data.notify.delivery-attempt, data.notify.preference and the digest-window
 * bookkeeping table (see notify-digest-window.entity.ts's comment) all belong to the notify feature and
 * are created together, idempotently, the same way create-tasks-table guards every statement with
 * IF NOT EXISTS so a fresh container and a re-run agree.
 */
export class CreateNotifyTables1758210000000 implements MigrationInterface {
    name = "CreateNotifyTables1758210000000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notify_notifications (
        id text PRIMARY KEY,
        kind text NOT NULL,
        recipient_id text NOT NULL,
        payload jsonb NOT NULL,
        digest_group_id text,
        created_at timestamptz NOT NULL
      )
    `)
        await queryRunner.query("CREATE INDEX IF NOT EXISTS notify_notifications_recipient_idx ON notify_notifications (recipient_id)")
        await queryRunner.query("CREATE INDEX IF NOT EXISTS notify_notifications_digest_group_idx ON notify_notifications (digest_group_id)")

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notify_delivery_attempts (
        notification_id text PRIMARY KEY REFERENCES notify_notifications (id),
        state text NOT NULL,
        attempt integer NOT NULL DEFAULT 0,
        failure_class text,
        started_at timestamptz,
        ended_at timestamptz,
        history jsonb NOT NULL DEFAULT '[]'::jsonb
      )
    `)
        await queryRunner.query("CREATE INDEX IF NOT EXISTS notify_delivery_attempts_state_idx ON notify_delivery_attempts (state)")

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notify_preferences (
        person_id text NOT NULL,
        channel text NOT NULL,
        unsubscribed boolean NOT NULL DEFAULT false,
        digest_window_minutes integer,
        PRIMARY KEY (person_id, channel)
      )
    `)

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notify_digest_windows (
        id text PRIMARY KEY,
        person_id text NOT NULL,
        channel text NOT NULL,
        opens_at timestamptz NOT NULL,
        closes_at timestamptz NOT NULL,
        flushed_at timestamptz
      )
    `)
        await queryRunner.query("CREATE INDEX IF NOT EXISTS notify_digest_windows_open_idx ON notify_digest_windows (person_id, channel) WHERE flushed_at IS NULL")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE IF EXISTS notify_digest_windows")
        await queryRunner.query("DROP TABLE IF EXISTS notify_preferences")
        await queryRunner.query("DROP TABLE IF EXISTS notify_delivery_attempts")
        await queryRunner.query("DROP TABLE IF EXISTS notify_notifications")
    }
}
