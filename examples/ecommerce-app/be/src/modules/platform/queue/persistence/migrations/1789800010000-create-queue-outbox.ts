import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the outbox table the queues write jobs in and the relay reads them from. */
export class CreateQueueOutbox1789800010000 implements MigrationInterface {
    name = "CreateQueueOutbox1789800010000"

    /** Creates the outbox and the partial index of the rows that wait. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE queue_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    queue varchar(200) NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    sent_at timestamptz
)`)
        await queryRunner.query(
            `CREATE INDEX queue_outbox_unsent_idx ON queue_outbox (created_at, id) WHERE sent_at IS NULL`,
        )
    }

    /** Drops the outbox. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE queue_outbox`)
    }
}
