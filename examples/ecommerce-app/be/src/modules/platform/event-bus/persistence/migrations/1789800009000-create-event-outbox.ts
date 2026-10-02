import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the outbox table the event bus writes events in and the relay reads them from. */
export class CreateEventOutbox1789800009000 implements MigrationInterface {
    name = "CreateEventOutbox1789800009000"

    /** Creates the outbox and the partial index of the rows that wait. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE event_outbox (
    id bigserial PRIMARY KEY,
    event_id varchar(200) NOT NULL,
    event_name varchar(200) NOT NULL,
    topic varchar(200) NOT NULL,
    message_key varchar(200) NOT NULL,
    envelope jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    sent_at timestamptz
)`)
        await queryRunner.query(`CREATE INDEX event_outbox_unsent_idx ON event_outbox (id) WHERE sent_at IS NULL`)
    }

    /** Drops the outbox. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE event_outbox`)
    }
}
