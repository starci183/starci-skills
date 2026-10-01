import type { MetricsExposition } from "./observability.contracts"

/** The request metrics registry behind the Prometheus scrape door. */
export interface Metrics {
    /** Records one finished request under its (method, route, status) label set. */
    recordRequest(method: string, route: string, status: number, durationMs: number): void
    /** The whole registry in Prometheus text exposition format. */
    render(): Promise<MetricsExposition>
}
