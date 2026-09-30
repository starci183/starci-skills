import { PUBLIC_TABLES } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { TableRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type { ExportMyDataData } from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/use-test-world"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"
import { AppModule as WorkerApp } from "../../../../apps/worker/src/app.module"

/**
 * Infra-down recovery. The world kills the database container mid-run (the one dependency the api /health probe checks; the
 * worker polls the same database), the spec asserts the api stays alive and answers /health with a clean 503 instead of
 * hanging or crashing, the world starts the same container back (identical port and data), and the spec asserts the api
 * recovers to 200, the persisted world is intact, and the worker recovered too: a sign-in made after the outage gets its
 * audit line appended through the outbox and the worker consumer.
 */
describe("resilience: infra recovery", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true }, worker: { module: WorkerApp } }, testTimeoutMs: 900_000 })

    const tables = async (): Promise<Array<string>> => {
        const rows: Array<TableRow> = await world.db.primary.query(PUBLIC_TABLES, [])
        return rows.map((row) => row.table_name)
    }

    it("a database outage yields a clean api error and the api and the worker recover when the database returns", async () => {
        const { api } = world.apps.todo
        const person = await world.signedInPerson("recovery")

        // Baseline: the data channel answers and the persisted world holds its migrated tables.
        expect(await tables()).toEqual(expect.arrayContaining(["sessions", "tasks", "outbox_messages", "inbox_claims"]))

        await world.interruptDatabase(async () => {
            // The api tolerates the outage: still answering HTTP, with a declared dependency error.
            await world.waitFor("api /health answers 503", async () => (await api.get("/health")).status === 503, { timeoutMs: 90_000, intervalMs: 1_000 })
        })

        await world.waitFor("api /health recovers to 200", async () => (await api.get("/health")).status === 200, { timeoutMs: 180_000, intervalMs: 1_000 })

        // Persisted-state evidence: the database answers real queries again, and its data survived the outage.
        expect(await tables()).toEqual(expect.arrayContaining(["sessions", "tasks"]))

        // The worker recovered with the database: a sign-in made now writes its audit message in the transaction of the
        // session; the line only becomes readable once the worker consumer appended it.
        const session = await api.signIn(person.email, person.password)
        await world.waitFor(
            "the audit line of the post-outage sign-in appended by the worker",
            async () => {
                const observed = await api.as(session.sessionToken).graphql<ExportMyDataData>("exportMyData")
                const lines = observed.data?.exportMyData ?? []
                return lines.some((line) => line.action === "login.signed-in") ? lines : null
            },
            { timeoutMs: 120_000, intervalMs: 1_000 },
        )
    })
})
