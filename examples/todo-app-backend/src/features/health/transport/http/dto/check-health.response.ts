/** The healthy answer of the probe door: the service name and the state of each dependency. */
export interface CheckHealthResponse {
    /** Always ok: an unhealthy service answers an error instead. */
    readonly status: "ok"
    /** The name of the reporting service. */
    readonly service: string
    /** The state of each probed dependency by name. */
    readonly checks: Readonly<Record<string, string>>
}
