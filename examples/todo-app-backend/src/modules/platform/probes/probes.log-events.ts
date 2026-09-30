/** Log events of the probes capability. */
export enum ProbesLogEvent {
    /** A dependency probe failed; the dependency name rides in the fields and the failure is the cause. */
    ProbeFailed = "probes.probe.failed",
}
