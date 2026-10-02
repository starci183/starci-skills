/** Log events of the process lifecycle: the entry points (main.ts of each app) log these. */
export enum LoggingLogEvent {
    /** The HTTP listener is bound and the service answers requests. */
    ServerStarted = "server.started",
    /** A worker app is running: no listener, its consumers poll until it is stopped. */
    WorkerStarted = "worker.started",
    /** The service failed before it could serve; the process exits non-zero. */
    StartupFailed = "server.startup_failed",
    /** The cli app's migrate run finished; the names of the applied migrations ride in the fields. */
    MigrationsApplied = "migrations.applied",
}
