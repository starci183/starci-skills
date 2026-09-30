import { LeaseEntity } from "./persistence/entities/lease.entity"
import { CreateJobLeases1758400000000 } from "./persistence/migrations/1758400000000-create-job-leases"

/** The entities of the lease capability, for the connection that holds them. */
export const leaseEntities = [LeaseEntity]

/** The migrations of the lease capability, in the order they run. */
export const leaseMigrations = [CreateJobLeases1758400000000]

export type { AcquireLeaseParams, LeaseGrant, ReleaseLeaseParams } from "./lease.contracts"
export { InjectLease } from "./lease.decorators"
export { LeaseModule } from "./lease.module"
export type { Lease } from "./lease.port"
