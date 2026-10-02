import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the order_summaries read-model table of the order database. */
export class CreateOrderSummaries1789800011000 implements MigrationInterface {
    name = "CreateOrderSummaries1789800011000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE order_summaries (
    order_id uuid PRIMARY KEY,
    person_id uuid NOT NULL,
    status varchar(16) NOT NULL,
    total_minor_units int NOT NULL,
    line_count int NOT NULL,
    loyalty_points int NOT NULL,
    placed_at timestamptz NOT NULL,
    paid_at timestamptz
)`)
        await queryRunner.query(
            `CREATE INDEX order_summaries_person_idx ON order_summaries (person_id, placed_at DESC)`,
        )
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE order_summaries`)
    }
}
