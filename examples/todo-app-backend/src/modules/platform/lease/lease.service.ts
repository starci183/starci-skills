import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EntityManager } from "typeorm"
import type { AcquireLeaseParams, LeaseGrant, ReleaseLeaseParams } from "./lease.contracts"
import type { Lease } from "./lease.port"
import { toFence } from "./persistence/lease.rows"
import type { AcquiredLeaseRow } from "./persistence/lease.rows"
import { ACQUIRE_LEASE, RELEASE_LEASE } from "./persistence/lease.sql"

@Injectable()
/** The Lease adapter over the `job_leases` table: one atomic upsert grants or refuses. */
export class PostgresLeaseService implements Lease {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Grants the lease when it is free, expired, or already held by the caller. */
    async acquire(params: AcquireLeaseParams): Promise<LeaseGrant | null> {
        const expiresAt = new Date(params.at.getTime() + params.ttlMs)
        const rows: Array<AcquiredLeaseRow> = await this.entityManager.query(ACQUIRE_LEASE, [
            params.name,
            params.holder,
            expiresAt,
            params.at,
        ])
        const row = rows[0]
        return row ? { name: params.name, holder: params.holder, fence: toFence(row) } : null
    }

    /** Releases the grant when it is still current. */
    async release(params: ReleaseLeaseParams): Promise<void> {
        await this.entityManager.query(RELEASE_LEASE, [params.grant.name, params.grant.fence, params.grant.holder])
    }
}
