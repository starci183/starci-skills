import {
    Injectable 
} from "@nestjs/common"

/**
 * The process-local metrics registry behind GET /metrics: per (method, route, status) request
 * counters plus a duration summary, rendered in Prometheus text exposition format so the dev stack's
 * prometheus service (`.starcistacks/dev/infra/compose/prometheus.yaml`, scraping api:3001/metrics)
 * can collect it without the example taking a prom-client dependency - the exposition format is four
 * HELP/TYPE/line conventions, not an SDK.
 *
 * Labels are deliberately low-cardinality: route is the matched express route template
 * (`/uploads/:uploadId/content`, never the concrete id - one label set per door, not per request) and
 * unmatched paths collapse to "unmatched", so a scanner's 404s cannot blow the registry up.
 */
interface RequestMetric {
  count: number;
  durationSumMs: number;
}

@Injectable()
/** Injectable service owning the request metrics the observability capability exposes; wired by the capability's own module. */
export class MetricsService {
    private readonly requests = new Map<string, RequestMetric>()

    /** Records one finished request under its (method, route, status) label set. */
    recordRequest(method: string, route: string, status: number, durationMs: number): void {
        const key = `${method}|${route}|${status}`
        const entry = this.requests.get(key) ?? {
            count: 0, durationSumMs: 0 
        }
        entry.count += 1
        entry.durationSumMs += durationMs
        this.requests.set(key,
            entry)
    }

    /** The whole registry as Prometheus text exposition - the body GET /metrics serves. */
    renderPrometheus(): string {
        const lines: Array<string> = [
            "# HELP http_requests_total HTTP requests the api has served, by method, route and status.",
            "# TYPE http_requests_total counter",
        ]
        const sorted = [...this.requests.entries()].sort(([a],
            [b]) => a.localeCompare(b))
        for (const [key,
            metric] of sorted) {
            const [method,
                route,
                status] = key.split("|")
            const labels = `{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"}`
            lines.push(`http_requests_total${labels} ${metric.count}`)
        }
        lines.push("# HELP http_request_duration_ms Time serving HTTP requests, in milliseconds.")
        lines.push("# TYPE http_request_duration_ms summary")
        for (const [key,
            metric] of sorted) {
            const [method,
                route,
                status] = key.split("|")
            const labels = `{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"}`
            lines.push(`http_request_duration_ms_sum${labels} ${metric.durationSumMs}`)
            lines.push(`http_request_duration_ms_count${labels} ${metric.count}`)
        }
        return `${lines.join("\n")}\n`
    }
}

/** Prometheus label values escape backslash, quote and newline - the only three characters with
 * meaning inside a label's double quotes. */
function escapeLabel(value: string): string {
    return value.replace(/\\/g,
        "\\\\").replace(/"/g,
        "\\\"").replace(/\n/g,
        "\\n")
}
