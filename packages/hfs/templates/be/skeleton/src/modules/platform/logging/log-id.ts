/** Every log line is named by a member of this enum, so a line can be found from the code that wrote it. */
export enum LogId {
    /** The HTTP listener is bound and the app serves requests. */
    ServerStarted = "server.started",
    /** The app failed before it could serve; the process exits non-zero. */
    StartupFailed = "server.startup_failed",
    /** A request ended in a failure the app's filter answered. */
    RequestFailed = "http.request_failed",
}
