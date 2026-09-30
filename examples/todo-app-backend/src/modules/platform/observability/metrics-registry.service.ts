import { Injectable } from "@nestjs/common"
import type { MetricsExposition } from "./observability.contracts"
import type { Metrics } from "./observability.port"

interface RequestMetric {
    readonly method: string
    readonly route: string
    readonly status: number
    count: number
    durationSumMs: number
}

const escapeLabel = (value: string): string =>
    value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")

const labelsOf = (metric: RequestMetric): string =>
    `{method="${escapeLabel(metric.method)}",route="${escapeLabel(metric.route)}",status="${metric.status}"}`

@Injectable()
/**
 * The process-local registry behind the Prometheus scrape door: per (method, route, status) request counters plus a
 * duration sum, in the text exposition format. Route is the matched route template, so the label set stays bounded.
 */
export class MetricsRegistryService implements Metrics {
    private readonly requests = new Map<string, RequestMetric>()

    /** Records one finished request. */
    recordRequest(method: string, route: string, status: number, durationMs: number): void {
        const key = JSON.stringify([method, route, status])
        const entry = this.requests.get(key) ?? { method, route, status, count: 0, durationSumMs: 0 }
        entry.count += 1
        entry.durationSumMs += durationMs
        this.requests.set(key, entry)
    }

    /** Renders the registry in Prometheus text exposition format. */
    render(): Promise<MetricsExposition> {
        const sorted = [...this.requests.entries()].sort(([a], [b]) => a.localeCompare(b))
        const lines: Array<string> = [
            "# HELP http_requests_total HTTP requests the api has served, by method, route and status.",
            "# TYPE http_requests_total counter",
            ...sorted.map(([, metric]) => `http_requests_total${labelsOf(metric)} ${metric.count}`),
            "# HELP http_request_duration_ms Time serving HTTP requests, in milliseconds.",
            "# TYPE http_request_duration_ms summary",
            ...sorted.flatMap(([, metric]) => [
                `http_request_duration_ms_sum${labelsOf(metric)} ${metric.durationSumMs}`,
                `http_request_duration_ms_count${labelsOf(metric)} ${metric.count}`,
            ]),
        ]
        return Promise.resolve({ exposition: `${lines.join("\n")}\n` })
    }
}
