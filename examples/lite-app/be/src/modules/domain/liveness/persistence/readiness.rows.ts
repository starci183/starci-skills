/** The one row the database probe answers. */
export interface DatabaseReadyRow {
    readonly ready: number
}

/** The one row the jobs probe answers. */
export interface JobStatsRow {
    readonly stats: unknown
}
