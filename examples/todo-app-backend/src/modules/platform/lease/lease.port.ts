import type { AcquireLeaseParams, LeaseGrant, ReleaseLeaseParams } from "./lease.contracts"

/** Cross-replica mutual exclusion with fencing: one holder per name at a time. */
export interface Lease {
    /** Grants the lease when nobody holds it (or the holder expired); null when another live holder has it. */
    acquire(params: AcquireLeaseParams): Promise<LeaseGrant | null>
    /** Lets the lease go, only when the grant is still the current grant of its name. */
    release(params: ReleaseLeaseParams): Promise<void>
}
