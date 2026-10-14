/** Log events of the liveness capability. */
export enum LivenessLogEvent {
    /** A required dependency did not answer its readiness probe; the check fails closed. */
    CheckFailed = "liveness.readiness.check-failed",
}
