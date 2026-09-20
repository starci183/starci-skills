import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    MetricsService 
} from "./metrics.service"

/**
 * The metrics registry's contract: every finished request lands under its (method, route, status)
 * label set, and render() emits Prometheus text exposition that the dev stack's prometheus can scrape
 * - HELP/TYPE headers, `http_requests_total` counters and the duration summary pair.
 */
describe("metrics service",
    () => {
        let moduleRef: TestingModule
        let metrics: MetricsService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [MetricsService],
            }).compile()
            metrics = moduleRef.get(MetricsService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("counts requests per label set and renders them as Prometheus exposition",
            async () => {
                metrics.recordRequest("GET",
                    "/health",
                    200,
                    3)
                metrics.recordRequest("GET",
                    "/health",
                    200,
                    5)
                metrics.recordRequest("POST",
                    "/graphql",
                    200,
                    12)
                metrics.recordRequest("GET",
                    "/gone",
                    404,
                    1)

                const text = metrics.renderPrometheus()
                expect(text).toContain("# TYPE http_requests_total counter")
                expect(text).toContain("http_requests_total{method=\"GET\",route=\"/health\",status=\"200\"} 2")
                expect(text).toContain("http_requests_total{method=\"POST\",route=\"/graphql\",status=\"200\"} 1")
                expect(text).toContain("http_requests_total{method=\"GET\",route=\"/gone\",status=\"404\"} 1")
                expect(text).toContain("http_request_duration_ms_sum{method=\"GET\",route=\"/health\",status=\"200\"} 8")
                expect(text).toContain("http_request_duration_ms_count{method=\"GET\",route=\"/health\",status=\"200\"} 2")
            })

        it("escapes label characters that would break the exposition format",
            async () => {
                metrics.recordRequest("GET",
                    "/weird\"route\\\n",
                    200,
                    1)
                const text = metrics.renderPrometheus()
                expect(text).toContain("route=\"/weird\\\"route\\\\\\n\"")
            })
    })
