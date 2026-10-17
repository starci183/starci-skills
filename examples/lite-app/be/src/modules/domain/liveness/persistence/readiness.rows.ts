/** The one row the database probe answers. */
export interface DatabaseReadyRow {
    /** The database sentinel; one means the query completed successfully. */
    readonly ready: number
}

/** The one row the jobs probe answers. */
export interface JobStatsRow {
    /** The job ledger statistics returned by its readiness probe. */
    readonly stats: unknown
}
