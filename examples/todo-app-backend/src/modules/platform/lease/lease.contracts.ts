/** What a caller asks for when it wants to hold a named lease. */
export interface AcquireLeaseParams {
    /** The name of the resource the lease protects, for example a job name. */
    readonly name: string
    /** The identity of the process asking. */
    readonly holder: string
    /** How long the lease stays valid without a renewal. */
    readonly ttlMs: number
    /** The instant the request is made, stamped by the caller with its Clock. */
    readonly at: Date
}

/** A granted lease: the fencing token grows with every grant of the same name, so a stale holder can be told apart. */
export interface LeaseGrant {
    /** The name of the protected resource. */
    readonly name: string
    /** The holder the lease was granted to. */
    readonly holder: string
    /** The fencing token of this grant. */
    readonly fence: number
}

/** What a caller asks for when it lets a lease go. */
export interface ReleaseLeaseParams {
    /** The grant to release; a grant that is no longer the current one releases nothing. */
    readonly grant: LeaseGrant
}

/** The answer of an acquire: the grant, or null when another live holder has the lease. */
export type LeaseAcquireResult = LeaseGrant | null
