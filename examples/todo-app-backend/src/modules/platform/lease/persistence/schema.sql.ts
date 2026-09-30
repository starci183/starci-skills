import { sql } from "@modules/platform/database"

/** Creates the lease table. */
export const CREATE_JOB_LEASES_TABLE = sql`CREATE TABLE job_leases (
    name varchar(200) PRIMARY KEY,
    holder varchar(200) NOT NULL,
    fence bigint NOT NULL,
    expires_at timestamptz NOT NULL
)`

/** Drops the lease table. */
export const DROP_JOB_LEASES_TABLE = sql`DROP TABLE job_leases`
