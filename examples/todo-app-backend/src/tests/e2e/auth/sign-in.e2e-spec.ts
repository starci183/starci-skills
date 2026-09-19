import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"

/**
 * auth/sign-in - one complete A->Z journey through the public GraphQL door only: create a realm
 * account, sign in twice, use the session it grants, watch the refusal contract hold, then delete the
 * account and watch the pair stop working. Boots the run-owned stack via bootE2EWorld;
 * `world.moduleRef.close()` in afterAll tears it down and asserts nothing is left.
 */
describe("auth/sign-in",
    () => {
        let world: E2EWorld

        beforeAll(async () => {
            world = await bootE2EWorld()
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            await world.moduleRef.close()
        })

        it("create account -> sign in -> use session -> refuse wrong pairs -> delete account",
            async () => {
                const {
                    stack, http, auth, dataSource 
                } = world
                const email = `e2e-${Date.now()}@todo.dev`
                const password = "e2e-pass-1"

                // The stack this spec is talking to is the one it booted: run-scoped project, api on its port.
                expect(stack.project).toMatch(/^todo-e2e-[0-9a-f]{8}$/)
                expect(stack.baseUrl).toBe(`http://127.0.0.1:${stack.ports.api}`)

                await auth.createAccount({
                    email, password 
                })

                const first = await auth.signIn(email,
                    password)
                expect(first.sessionToken).toBeTruthy()
                // A person is Keycloak's subject for this identity: stable across sign-ins, never a bare email.
                expect(first.personId).toBeTruthy()

                // Out-of-band verify: the session the door handed out is a real row in this run's postgres.
                const sessionRows = await dataSource.query<Array<{ token: string; person_id: string }>>(
                    "select token, person_id from sessions where token = $1",
                    [first.sessionToken],
                )
                expect(sessionRows).toHaveLength(1)
                expect(sessionRows[0].person_id).toBe(first.personId)

                // The session grants access: a task created through it is read back out of the caller's list.
                const title = `e2e:sign-in:${Date.now()}`
                const created = await http.graphql<{ createTask: { taskId: string; title: string } }>("createTask",
                    {
                        variables: {
                            input: {
                                title 
                            } 
                        },
                        token: first.sessionToken,
                    })
                expect(created.errorCode).toBeNull()
                const listed = await http.graphql<{ tasks: Array<{ taskId: string; title: string }> }>("listTasks",
                    {
                        token: first.sessionToken,
                    })
                expect(listed.errors).toBeNull()
                const mine = listed.data?.tasks.find((task) => task.taskId === created.data?.createTask.taskId)
                expect(mine?.title).toBe(title)

                // The list is the signer's own: another person's session never contains this task.
                const stranger = await auth.persona("other")
                const strangerList = await http.graphql<{ tasks: Array<{ taskId: string }> }>("listTasks",
                    {
                        token: stranger.sessionToken,
                    })
                expect(strangerList.data?.tasks.map((task) => task.taskId)).not.toContain(created.data?.createTask.taskId)

                // Same pair again: same person, a different session, and the first session stays live.
                const second = await auth.signIn(email,
                    password)
                expect(second.personId).toBe(first.personId)
                expect(second.sessionToken).not.toBe(first.sessionToken)
                const withFirst = await http.graphql<{ tasks: Array<{ taskId: string }> }>("listTasks",
                    {
                        token: first.sessionToken 
                    })
                expect(withFirst.errorCode).toBeNull()

                // A wrong pair is refused without naming which half: an unknown email and a wrong password return
                // the identical refusal.
                const wrongPassword = await http.graphql("signIn",
                    {
                        variables: {
                            input: {
                                email, password: "definitely-not-the-password" 
                            } 
                        },
                    })
                const unknownEmail = await http.graphql("signIn",
                    {
                        variables: {
                            input: {
                                email: `nobody-${Date.now()}@todo.dev`, password: "whatever" 
                            } 
                        },
                    })
                expect(wrongPassword.errorCode).toBe("INVALID_CREDENTIALS")
                expect(unknownEmail.errorCode).toBe("INVALID_CREDENTIALS")
                expect(wrongPassword.data).toBeNull()
                expect(JSON.stringify(unknownEmail.errors)).toBe(JSON.stringify(wrongPassword.errors))

                // Account deleted through the realm admin door: the pair stops working, the proof is public.
                await auth.deleteAccount(email)
                const afterDelete = await http.graphql("signIn",
                    {
                        variables: {
                            input: {
                                email, password 
                            } 
                        },
                    })
                expect(afterDelete.errorCode).toBe("INVALID_CREDENTIALS")
            })
    })
