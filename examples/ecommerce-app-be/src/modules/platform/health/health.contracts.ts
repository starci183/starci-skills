/** The state of one probed dependency. */
export type ProbeState = "ok" | "unreachable"

/** What the checker found: the service name, the state of each dependency and whether all are up. */
export interface HealthReport {
    /** The name of the reporting service. */
    readonly service: string
    /** The state of each probed dependency by name. */
    readonly checks: Readonly<Record<string, ProbeState>>
    /** True when every dependency answered. */
    readonly healthy: boolean
}
