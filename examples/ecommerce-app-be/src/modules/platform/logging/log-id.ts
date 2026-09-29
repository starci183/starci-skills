/** Every log line is named by a member of this enum, so a line can be found from the code that wrote it. */
export enum LogId {
    /** The HTTP listener is bound and the service answers requests. */
    ServerStarted = "server.started",
    /** The service failed before it could serve; the process exits non-zero. */
    StartupFailed = "server.startup_failed",
    /** `apps/migrate` finished; the names of the migrations it applied ride in the payload (an empty list when the schema was already current). */
    MigrationsApplied = "migrations.applied",
    /** A dependency probe of /health failed; the dependency name and the failure message ride in the payload, and the probe answers 503. */
    DependencyProbeFailed = "health.dependency_probe_failed",
}
