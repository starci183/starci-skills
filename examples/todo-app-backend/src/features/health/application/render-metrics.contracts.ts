/** Rendering the metrics takes no input. */
export type RenderMetricsRequest = Readonly<Record<string, never>>

/** The request metrics of this process in the Prometheus text exposition format. */
export interface RenderMetricsResult {
    /** The exposition text. */
    readonly exposition: string
}
