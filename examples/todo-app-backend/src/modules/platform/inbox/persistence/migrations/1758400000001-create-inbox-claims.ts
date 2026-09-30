import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the table the inbox claims events in. */
export class CreateInboxClaims1758400000001 implements MigrationInterface {
    name = "CreateInboxClaims1758400000001"

    /** Creates the claims table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE inbox_claims (
    source varchar(200) NOT NULL,
    event_id varchar(200) NOT NULL,
    claimed_at timestamptz NOT NULL,
    PRIMARY KEY (source, event_id)
)`)
    }

    /** Drops the claims table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE inbox_claims`)
    }
}
