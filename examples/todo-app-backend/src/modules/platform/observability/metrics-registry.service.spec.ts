import { Test } from "@nestjs/testing"
import { MetricsRegistryService } from "./metrics-registry.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [MetricsRegistryService] }).compile()
    return moduleRef.get(MetricsRegistryService)
}

describe("MetricsRegistryService", () => {
    describe("render", () => {
        it("renders only the headers before any request is recorded", async () => {
            const metrics = await build()

            expect((await metrics.render()).exposition.split("\n")).toEqual([
                "# HELP http_requests_total HTTP requests the api has served, by method, route and status.",
                "# TYPE http_requests_total counter",
                "# HELP http_request_duration_ms Time serving HTTP requests, in milliseconds.",
                "# TYPE http_request_duration_ms summary",
                "",
            ])
        })

        it("counts and sums the requests of one label set", async () => {
            const metrics = await build()
            metrics.recordRequest("GET", "/health", 200, 5)
            metrics.recordRequest("GET", "/health", 200, 7)

            const { exposition } = await metrics.render()

            expect(exposition).toContain('http_requests_total{method="GET",route="/health",status="200"} 2\n')
            expect(exposition).toContain('http_request_duration_ms_sum{method="GET",route="/health",status="200"} 12\n')
            expect(exposition).toContain('http_request_duration_ms_count{method="GET",route="/health",status="200"} 2\n')
        })

        it("keeps a separate series per method, route and status, sorted by label set", async () => {
            const metrics = await build()
            metrics.recordRequest("POST", "/graphql", 200, 1)
            metrics.recordRequest("GET", "/health", 503, 2)

            const lines = (await metrics.render()).exposition.split("\n")

            expect(lines.filter((line) => line.startsWith("http_requests_total{"))).toEqual([
                'http_requests_total{method="GET",route="/health",status="503"} 1',
                'http_requests_total{method="POST",route="/graphql",status="200"} 1',
            ])
        })

        it("escapes quotes, backslashes and newlines in a label value", async () => {
            const metrics = await build()
            metrics.recordRequest("GET", 'a"b\\c\nd', 200, 1)

            expect((await metrics.render()).exposition).toContain('route="a\\"b\\\\c\\nd"')
        })
    })
})
