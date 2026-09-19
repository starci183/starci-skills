import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"

jest.setTimeout(120_000)

const SIGN_OUT = "mutation SignOut($input: SignOutInput!) { signOut(input: $input) { signedOut } }"
const TASKS = "query Tasks { tasks { taskId title complete } }"

// The run-owned realm seeds this identity (.starcistacks/dev/infra/compose/realm-todo.json).
const DEMO = {
    email: "demo@todo.dev", password: "todo-demo-pass" 
}

interface CountRow {
  count: number;
}

/**
 * fr.login.sign-out end to end: a session that answers calls ends by its own token through the
 * public signOut door (t-revoke deletes the row, so the next bearer read is SESSION_NOT_FOUND and a
 * second signOut refuses the same way), and the same identity recovers with a fresh sign-in. The
 * Postgres reads are out-of-band verification only - every step of the journey itself travels the
 * real /graphql door.
 */
describe("session sign-out (e2e)",
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

        it("sign-in → session serves calls → sign-out → token refused and row gone → re-sign-in recovers",
            async () => {
                const {
                    http, auth, dataSource 
                } = world
                const { sessionToken, personId } = await auth.signIn(DEMO.email,
                    DEMO.password)
                const asSession = http.client({
                    bearerToken: sessionToken 
                })

                const live = await asSession.graphql<{ tasks: Array<unknown> }>(TASKS)
                expect(live.errors).toBeNull()
                expect(Array.isArray(live.data?.tasks)).toBe(true)

                const beforeRows = await dataSource.query<Array<CountRow>>(
                    "SELECT COUNT(*)::int AS count FROM sessions WHERE token = $1",
                    [sessionToken],
                )
                expect(beforeRows[0].count).toBe(1)

                const signedOut = await http
                    .client()
                    .graphql<{ signOut: { signedOut: boolean } }>(SIGN_OUT,
                        {
                            input: {
                                sessionToken 
                            } 
                        })
                expect(signedOut.errors).toBeNull()
                expect(signedOut.data?.signOut.signedOut).toBe(true)

                const refused = await asSession.graphql(TASKS)
                expect(refused.errorCode).toBe("SESSION_NOT_FOUND")
                expect(refused.data).toBeNull()

                const afterRows = await dataSource.query<Array<CountRow>>(
                    "SELECT COUNT(*)::int AS count FROM sessions WHERE token = $1",
                    [sessionToken],
                )
                expect(afterRows[0].count).toBe(0)

                // Revocation is not idempotent at the door: signOut on a dead token is the same refusal a
                // forged or expired one gets.
                const again = await http.client().graphql(SIGN_OUT,
                    {
                        input: {
                            sessionToken 
                        } 
                    })
                expect(again.errorCode).toBe("SESSION_NOT_FOUND")

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
