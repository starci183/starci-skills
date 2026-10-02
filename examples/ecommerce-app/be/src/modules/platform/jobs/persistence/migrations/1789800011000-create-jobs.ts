import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the job table the fenced jobs claim and settle their rows in. */
export class CreateJobs1789800011000 implements MigrationInterface {
    name = "CreateJobs1789800011000"

    /** Creates the table; the job key is unique and the token starts at 1 with the first claim. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind varchar(200) NOT NULL,
    job_key varchar(200) NOT NULL UNIQUE,
    status varchar(16) NOT NULL CHECK (status IN ('running', 'failed', 'done')),
    current_step varchar(200),
    fencing_token bigint NOT NULL CHECK (fencing_token >= 1),
    claimed_by varchar(200),
    lease_expires_at timestamptz,
    payload jsonb NOT NULL,
    error text,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE jobs`)
    }
}
