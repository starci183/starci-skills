/* eslint-disable starci-be/e2e-asserts-persisted-state -- what this journey reads back is the
   in-process Prometheus registry itself: /metrics counters for the requests the suite just made,
   observed through the same public endpoint an operator would scrape. Request correlation and the
   access log leave no database row to SELECT. */
import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"

jest.setTimeout(120_000)

/**
 * The observability slice over the real stack: /ready answers the dependency-checked readiness the
 * boot probe already relies on, /metrics serves Prometheus text exposition that counts the requests
 * the suite itself just made, and every response echoes the x-request-id correlation header - the
 * inbound one when a client sends it, a minted uuid when it does not. Secrets never appear: the
 * access line carries requestId/method/route/status/durationMs and nothing else.
 */
describe("observability probes (e2e)",
    () => {
        let world: E2EWorld

        beforeAll(async () => {
            world = await bootE2EWorld()
            expect((await world.http.anonymous().get<{ status: string }>("/health")).data.status).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            await world.moduleRef.close()
        })

        it("ready answers ok, metrics counts the suite's own traffic, and x-request-id round-trips",
            async () => {
                const api = world.http.anonymous()

                const ready = await api.get<{ status: string }>("/ready")
                expect(ready.status).toBe(200)
                expect(ready.body.status).toBe("ok")

                // Correlation: a presented id is honoured and echoed verbatim.
                const correlated = await api.get("/health",
                    {
                        headers: {
                            "x-request-id": "e2e-fixed-request-id" 
                        } 
                    })
                expect(correlated.headers["x-request-id"]).toBe("e2e-fixed-request-id")

                // ...and an absent one is minted - a uuid the client can quote back when reporting.
                const minted = await api.get("/health")
                expect(minted.headers["x-request-id"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

                const metrics = await api.get<string>("/metrics")
                expect(metrics.status).toBe(200)
                expect(metrics.headers["content-type"]).toContain("text/plain")
                const text = String(metrics.body)
                expect(text).toContain("# TYPE http_requests_total counter")
                // The suite's own earlier calls are already counted under their route templates.
                expect(text).toMatch(/http_requests_total\{method="GET",route="\/ready",status="200"\} [1-9]/)
                expect(text).toMatch(/http_requests_total\{method="GET",route="\/health",status="200"\} [1-9]/)
                expect(text).toContain("http_request_duration_ms_count")
            })
    })
