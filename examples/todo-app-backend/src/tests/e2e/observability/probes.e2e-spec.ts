/* What this journey reads back is the in-process request-metrics registry itself: /metrics counters for the requests the
 suite just made, observed through the same public endpoint an operator would scrape. Request correlation and the access
 line leave no database row to SELECT. */
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import type { TasksData } from "../setup/e2e-views.contracts"

interface HealthBody {
    status: string
    service: string
    checks: Record<string, string>
}

/**
 * The observability slice over the real stack: /health answers the dependency-checked probe the boot already relies on
 * (there is no /ready door), /metrics serves Prometheus text exposition that counts the requests the suite itself just made
 * (REST routes by template, every GraphQL operation under /graphql), and every response echoes the x-request-id correlation
 * header: the inbound one when a client sends it, a minted uuid when it does not.
 */
describe("observability probes (e2e)", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("observability/probes")
    }, 600_000)

    afterAll(async () => {
        await world.close()
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("health answers ok, metrics counts the own traffic of the suite, and x-request-id round-trips", async () => {
        const { database, graphql, auth } = world
        const api = world.http()

        const health = await api.get<HealthBody>("/health")
        expect(health.status).toBe(200)
        expect(health.body.status).toBe("ok")
        expect(health.body.service).toBe("todo")
        // Health is dependency-checked, so the data tier it vouches for must itself answer.
        expect(Object.values(health.body.checks).length).toBeGreaterThan(0)
        expect(Object.values(health.body.checks).every((state) => state === "ok")).toBe(true)
        expect(await database.ping()).toBe(true)

        // The readiness door of the old shape is gone: an unmatched route is a plain 404.
        expect((await api.get("/ready")).status).toBe(404)

        // Correlation: a presented id is honoured and echoed verbatim.
        const correlated = await api.get("/health", { headers: { "x-request-id": "e2e-fixed-request-id" } })
        expect(correlated.headers["x-request-id"]).toBe("e2e-fixed-request-id")
        // ...and an absent one is minted: a uuid the client can quote back when reporting.
        const minted = await api.get("/health")
        expect(minted.headers["x-request-id"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

        // One GraphQL operation, so the /graphql route is counted too.
        const session = await auth.persona("owner")
        expect((await graphql.client(session.sessionToken).read<TasksData>("tasks")).errors).toBeNull()

        const metrics = await api.get<string>("/metrics")
        expect(metrics.status).toBe(200)
        expect(metrics.headers["content-type"]).toContain("text/plain")
        const text = String(metrics.body)
        expect(text).toContain("# TYPE http_requests_total counter")
        // The earlier calls of the suite are already counted under their route templates.
        expect(text).toMatch(/http_requests_total\{method="GET",route="\/health",status="200"\} [1-9]/)
        expect(text).toMatch(/http_requests_total\{method="POST",route="\/graphql",status="200"\} [1-9]/)
        expect(text).toContain("http_request_duration_ms_count")
    })
})
