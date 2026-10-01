import { LeaseEntity } from "./entities/lease.entity"
import { CreateJobLeases1758400000000 } from "./migrations/1758400000000-create-job-leases"

/** The entities of the lease capability, for the connection that holds them. */
export const leaseEntities = [LeaseEntity]

/** The migrations of the lease capability, in the order they run. */
export const leaseMigrations = [CreateJobLeases1758400000000]
