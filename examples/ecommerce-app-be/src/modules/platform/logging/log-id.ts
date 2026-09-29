/** Every log line is named by a member of this enum, so a line can be found from the code that wrote it. */
export enum LogId {
    /** The HTTP listener is bound and the service answers requests. */
    ServerStarted = "server.started",
    /** The service failed before it could serve; the process exits non-zero. */
    StartupFailed = "server.startup_failed",
}
