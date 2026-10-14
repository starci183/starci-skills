/** The name of one required dependency the readiness probe checks. */
export type ReadinessCheckName = "database" | "jobs"

/** What a readiness probe answers. */
export interface ReadinessReport {
    /** Always ready: the probe answers only while every required dependency answers. */
    readonly status: "ready"
    /** The named probe results; a check is present only when its dependency answered. */
    readonly checks: Readonly<Record<ReadinessCheckName, "ok">>
}
