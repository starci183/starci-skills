import { MetricsRegistryService } from "./metrics-registry.service"

describe("MetricsRegistryService", () => {
    it("counts requests per label set and sums their durations", () => {
        const registry = new MetricsRegistryService()
        registry.recordRequest("GET", "/health", 200, 5)
        registry.recordRequest("GET", "/health", 200, 7)
        registry.recordRequest("POST", "/graphql", 200, 30)
        const text = registry.renderPrometheus()
        expect(text).toContain('http_requests_total{method="GET",route="/health",status="200"} 2')
        expect(text).toContain('http_request_duration_ms_sum{method="GET",route="/health",status="200"} 12')
        expect(text).toContain('http_request_duration_ms_count{method="POST",route="/graphql",status="200"} 1')
    })

    it("renders only the headers when nothing was recorded", () => {
        expect(new MetricsRegistryService().renderPrometheus()).toContain("# TYPE http_requests_total counter")
    })

    it("escapes quotes, backslashes and newlines in label values", () => {
        const registry = new MetricsRegistryService()
        registry.recordRequest("GET", 'a"b\\c\nd', 200, 1)
        expect(registry.renderPrometheus()).toContain('route="a\\"b\\\\c\\nd"')
    })
})
