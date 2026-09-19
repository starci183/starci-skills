import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"

jest.setTimeout(120_000)

const TASKS = "query Tasks { tasks { taskId title complete } }"

// The run-owned realm seeds this identity (.starcistacks/dev/infra/compose/realm-todo.json).
const DEMO = {
    email: "demo@todo.dev", password: "todo-demo-pass" 
}

interface CountRow {
  count: number;
}

/**
 * Session expiry end to end (the api exposes no token-refresh door, so expiry is the session's
 * terminal journey). sds.login.session-store enforces expiry on read rather than by a sweeper: an
 * expires_at in the past makes the next bearer call SESSION_EXPIRED and that same read deletes the
 * row (t-expire), so every later call is the plain SESSION_NOT_FOUND refusal. No public operation
 * can age a session, so the precondition is created out-of-band in Postgres; the behavior under
 * test - refuse, reap, recover - all travels the real /graphql door.
 */
describe("session expiry (e2e)",
    () => {
        let world: E2EWorld

        beforeAll(async () => {
            world = await bootE2EWorld()
            expect((await world.http.client().get<{ status: string }>("/health")).data.status).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            await world.moduleRef.close()
            // Teardown asserted: closing the module ran compose down -v and the stack service verified no
            // container or volume of this run's project remains.
            expect(world.stack.teardownReport?.clean).toBe(true)
        })

        it("live session → expiry passes → SESSION_EXPIRED → row reaped → SESSION_NOT_FOUND → re-sign-in recovers",
            async () => {
                const {
                    http, auth, db, dataSource 
                } = world
                const { sessionToken, personId } = await auth.signIn(DEMO.email,
                    DEMO.password)
                const asSession = http.client({
                    bearerToken: sessionToken 
                })

                const live = await asSession.graphql<{ tasks: Array<unknown> }>(TASKS)
                expect(live.errors).toBeNull()

                // DML with RETURNING stays on db.query: TypeORM answers a [rows, affected] tuple and
                // the service unwraps it; plain reads go through the DataSource itself.
                const aged = await db.query<{ token: string }>(
                    "UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token = $1 RETURNING token",
                    [sessionToken],
                )
                expect(aged).toHaveLength(1)

                const expired = await asSession.graphql(TASKS)
                expect(expired.errorCode).toBe("SESSION_EXPIRED")
                expect(expired.data).toBeNull()

                // The refusing read itself reaps the row - expiry is enforced where the session is looked up,
                // so a stopped sweeper can never leave a session alive past its time.
                const reaped = await dataSource.query<Array<CountRow>>(
                    "SELECT COUNT(*)::int AS count FROM sessions WHERE token = $1",
                    [sessionToken],
                )
                expect(reaped[0].count).toBe(0)

                const gone = await asSession.graphql(TASKS)
                expect(gone.errorCode).toBe("SESSION_NOT_FOUND")
                expect(gone.data).toBeNull()

                const recovered = await auth.signIn(DEMO.email,
                    DEMO.password)
                expect(recovered.personId).toBe(personId)
                expect(recovered.sessionToken).not.toBe(sessionToken)
                const relisted = await http
                    .client({
                        bearerToken: recovered.sessionToken 
                    })
                    .graphql<{ tasks: Array<unknown> }>(TASKS)
                expect(relisted.errors).toBeNull()
            })
    })
