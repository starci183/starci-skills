import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the lease table the scheduler takes its per-job leases from. */
export class CreateJobLeases1758400000000 implements MigrationInterface {
    name = "CreateJobLeases1758400000000"

    /** Creates `job_leases`. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE job_leases (
    name varchar(200) PRIMARY KEY,
    holder varchar(200) NOT NULL,
    fence bigint NOT NULL,
    expires_at timestamptz NOT NULL
)`)
    }

    /** Drops `job_leases`. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE job_leases`)
    }
}
