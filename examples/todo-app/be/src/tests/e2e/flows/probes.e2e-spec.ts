/* What this journey reads back is the in-process request-metrics registry itself: /metrics counters for the requests the
 suite just made, observed through the same public endpoint an operator would scrape. Request correlation and the access
 line leave no database row to SELECT. */
import { PING_DATABASE } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { AliveRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type { TasksData } from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/use-test-world"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"

interface HealthBody {
    status: string
    service: string
    checks: Record<string, string>
}

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * The observability slice over the real api: /health answers the dependency-checked probe (there is no /ready door),
 * /metrics serves Prometheus text exposition that counts the requests the suite itself just made (REST routes by template,
 * every GraphQL operation under /graphql), and every response echoes the x-request-id correlation header: the inbound one
 * when a client sends it, a minted uuid when it does not.
 */
describe("observability probes (e2e)", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true } } })

    it("health answers ok, metrics counts the own traffic of the suite, and x-request-id round-trips", async () => {
        const { api } = world.apps.todo

        const health = await api.get<HealthBody>("/health")
        expect(health.status).toBe(200)
        expect(health.body.status).toBe("ok")
        expect(health.body.service).toBe("todo")
        // Health is dependency-checked, so the data tier it vouches for must itself answer.
        expect(Object.values(health.body.checks).length).toBeGreaterThan(0)
        expect(Object.values(health.body.checks).every((state) => state === "ok")).toBe(true)
        const [alive]: Array<AliveRow> = await world.db.primary.query(PING_DATABASE, [])
        expect(alive?.alive).toBe(1)

        // The readiness door of the old shape is gone: an unmatched route is a plain 404.
        expect((await api.get("/ready")).status).toBe(404)

        // Correlation: a presented id is honoured and echoed verbatim.
        const correlated = await api.get("/health", { headers: { "x-request-id": "e2e-fixed-request-id" } })
        expect(correlated.headers["x-request-id"]).toBe("e2e-fixed-request-id")
        // ...and an absent one is minted: a uuid the client can quote back when reporting.
        const minted = await api.get("/health")
        expect(minted.headers["x-request-id"]).toMatch(REQUEST_ID)

        // One GraphQL operation, so the /graphql route is counted too.
        const person = await world.signedInPerson("probes")
        expect((await person.caller.graphql<TasksData>("tasks")).errors).toBeNull()

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
