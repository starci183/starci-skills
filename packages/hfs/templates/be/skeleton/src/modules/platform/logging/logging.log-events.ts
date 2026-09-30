/** Log events of the process lifecycle: the entry points (main.ts of each app) log these. */
export enum LoggingLogEvent {
    /** The HTTP listener is bound and the service answers requests. */
    ServerStarted = "server.started",
    /** The service failed before it could serve; the process exits non-zero. */
    StartupFailed = "server.startup_failed",
}
