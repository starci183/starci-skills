/** The required primary database answered before the readiness deadline. */
export interface ReadinessReport {
    /** Whether this process can serve requests requiring the database. */
    readonly ok: true
}
