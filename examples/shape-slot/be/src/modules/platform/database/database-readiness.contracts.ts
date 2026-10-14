/** Names of the required database dependencies actually probed. */
export interface DatabaseReadinessChecks {
    /** The required primary connection answered its probe. */
    readonly primary: "ok"
}

/** A successful check of the primary database required by the core API. */
export interface DatabaseReadinessReport {
    /** Success is answered only after the required connection responded. */
    readonly status: "ok"
    /** Names of the required dependencies actually probed. */
    readonly dependencies: DatabaseReadinessChecks
}
