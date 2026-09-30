import { Injectable } from "@nestjs/common"
import type { Metrics } from "./observability.port"

interface RequestMetric {
    count: number
    durationSumMs: number
}

const escapeLabel = (value: string): string =>
    value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")

const labelsOf = (key: string): string => {
    const [method = "", route = "", status = ""] = key.split("|")
    return `{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"}`
}

@Injectable()
/**
 * The process-local registry behind the Prometheus scrape door: per (method, route, status) request counters plus a
 * duration sum, in the text exposition format. Route is the matched route template, so the label set stays bounded.
 */
export class MetricsRegistry implements Metrics {
    private readonly requests = new Map<string, RequestMetric>()

    /** Records one finished request. */
    recordRequest(method: string, route: string, status: number, durationMs: number): void {
        const key = `${method}|${route}|${status}`
        const entry = this.requests.get(key) ?? { count: 0, durationSumMs: 0 }
        entry.count += 1
        entry.durationSumMs += durationMs
        this.requests.set(key, entry)
    }

    /** Renders the registry in Prometheus text exposition format. */
    renderPrometheus(): string {
        const sorted = [...this.requests.entries()].sort(([a], [b]) => a.localeCompare(b))
        const lines: Array<string> = [
            "# HELP http_requests_total HTTP requests the api has served, by method, route and status.",
            "# TYPE http_requests_total counter",
            ...sorted.map(([key, metric]) => `http_requests_total${labelsOf(key)} ${metric.count}`),
            "# HELP http_request_duration_ms Time serving HTTP requests, in milliseconds.",
            "# TYPE http_request_duration_ms summary",
            ...sorted.flatMap(([key, metric]) => [
                `http_request_duration_ms_sum${labelsOf(key)} ${metric.durationSumMs}`,
                `http_request_duration_ms_count${labelsOf(key)} ${metric.count}`,
            ]),
        ]
        return `${lines.join("\n")}\n`
    }
}
