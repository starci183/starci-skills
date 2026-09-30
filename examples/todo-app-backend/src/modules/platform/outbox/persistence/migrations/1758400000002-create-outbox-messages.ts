import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the table durable messages are written to. */
export class CreateOutboxMessages1758400000002 implements MigrationInterface {
    name = "CreateOutboxMessages1758400000002"

    /** Creates the table and its due index. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE outbox_messages (
    id uuid PRIMARY KEY,
    queue varchar(120) NOT NULL,
    event_id varchar(200) NOT NULL,
    payload jsonb NOT NULL,
    available_at timestamptz NOT NULL,
    attempts int NOT NULL DEFAULT 0,
    status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'dead')),
    last_error text,
    created_at timestamptz NOT NULL,
    UNIQUE (queue, event_id)
)`)
        await queryRunner.query(`CREATE INDEX outbox_messages_due_idx ON outbox_messages (available_at) WHERE status = 'pending'`)
    }

    /** Drops the table with its index. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE outbox_messages`)
    }
}
