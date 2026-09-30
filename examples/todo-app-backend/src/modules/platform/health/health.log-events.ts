/** Log events of the health capability. */
export enum HealthLogEvent {
    /** A dependency probe failed; the dependency name rides in the fields and the failure is the cause. */
    ProbeFailed = "health.probe.failed",
}
