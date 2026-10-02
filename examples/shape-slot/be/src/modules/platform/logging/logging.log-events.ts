/** Log events of the process lifecycle: the entry points (main.ts of each app) log these. */
export enum LoggingLogEvent {
    /** The HTTP listener is bound and the service answers requests. */
    ServerStarted = "server.started",
    /** The service failed before it could serve; the process exits non-zero. */
    StartupFailed = "server.startup_failed",
    /** The worker started: its jobs are ticking and its consumers are polling. */
    WorkerStarted = "worker.started",
    /** The migrate command finished; the names of the applied migrations ride in the fields. */
    MigrationsApplied = "migrations.applied",
    /** The seed command finished; the seed files it ran ride in the fields, by connection. */
    SeedsApplied = "seeds.applied",
}
