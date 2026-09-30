import type { MigrationInterface, QueryRunner } from "typeorm"
import { CREATE_JOB_LEASES_TABLE, DROP_JOB_LEASES_TABLE } from "../schema.sql"

/** Creates the lease table the scheduler takes its per-job leases from. */
export class CreateJobLeases1758400000000 implements MigrationInterface {
    name = "CreateJobLeases1758400000000"

    /** Creates `job_leases`. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_JOB_LEASES_TABLE)
    }

    /** Drops `job_leases`. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_JOB_LEASES_TABLE)
    }
}
