/** What a liveness probe answers. */
export interface LivenessReport {
    /** Always ok: the probe answers only while the process does. */
    readonly status: "ok"
    /** When this process started, as an ISO 8601 instant. */
    readonly startedAt: string
    /** Whole seconds the process has been up. */
    readonly uptimeSeconds: number
}
