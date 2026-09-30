import { randomUUID } from "node:crypto"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { GRAPHQL_DOCUMENTS } from "../setup/e2e-graphql.client"
import { present } from "../setup/e2e.error"
import type { CreateTaskData, SignInData, TasksData } from "../setup/e2e-views.contracts"

interface GraphqlErrorBody {
    errors?: Array<{ message: string; extensions?: { code?: string } }>
}

/**
 * auth/sign-in: one complete journey through the public GraphQL door only. Create a realm account, sign in twice, use the
 * session it grants, watch the refusal contract hold (declared code on extensions.code, the same answer for a wrong
 * password and an unknown email, the display text localized by the caller language), then delete the account and watch the
 * pair stop working. Persisted state is checked out-of-band. Boots the run-owned stack through bootE2eWorld; closing the
 * world in afterAll tears it down and asserts nothing is left.
 */
describe("auth/sign-in", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("auth/sign-in")
    }, 600_000)

    afterAll(async () => {
        await world.close()
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("create account -> sign in -> use session -> refuse wrong pairs -> delete account", async () => {
        const { stack, graphql, auth, database } = world
        const email = `e2e-${randomUUID()}@todo.dev`
        const password = "e2e-pass-1"
        const anonymous = graphql.client()

        // The stack this spec talks to is the one it booted: a run-scoped project with the api on its own port.
        expect(stack.project).toMatch(/^todo-e2e-[0-9a-f]{8}-[0-9a-f]{8}$/)
        expect(stack.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
        expect(stack.readiness.map((step) => step.label)).toEqual(["postgres", "keycloak", "api /health", "worker started"])

        const account = await auth.createAccount({ email, password })
        const first = await auth.signIn(email, password)
        // A person is the identity provider subject: stable across sign-ins, never a bare email.
        expect(first.personId).toBe(account.personId)

        // Out-of-band: the session the door handed out is a real row of this run's database.
        const sessionRows = await database.sessionByToken(first.sessionToken)
        expect(sessionRows).toEqual([{ token: first.sessionToken, person_id: first.personId }])

        // The session grants access: a task created through it is read back out of the caller's list.
        const caller = graphql.client(first.sessionToken)
        const title = `e2e:sign-in:${randomUUID()}`
        const created = await caller.mutate<CreateTaskData>("createTask", { variables: { input: { title } } })
        expect(created.errorCode).toBeNull()
        const taskId = present(created.data, "createTask data").createTask.taskId
        const listed = await caller.read<TasksData>("tasks")
        expect(listed.errors).toBeNull()
        expect(listed.data?.tasks.find((task) => task.taskId === taskId)?.title).toBe(title)

        // The list is the signer's own: another person's session never contains this task.
        const stranger = await auth.persona("other")
        const strangerList = await graphql.client(stranger.sessionToken).read<TasksData>("tasks")
        expect(strangerList.data?.tasks.map((task) => task.taskId)).not.toContain(taskId)

        // The same pair again: same person, a different session, and the first session stays live.
        const second = await auth.signIn(email, password)
        expect(second.personId).toBe(first.personId)
        expect(second.sessionToken).not.toBe(first.sessionToken)
        expect((await caller.read<TasksData>("tasks")).errorCode).toBeNull()

        // Every door but the public ones is default-deny: without a live session the call is refused.
        const denied = await anonymous.read<TasksData>("tasks")
        expect(denied.errorCode).toBe("SESSION_NOT_FOUND")
        expect(denied.data).toBeNull()

        // A wrong pair is refused without naming which half: an unknown email and a wrong password are the identical refusal.
        const wrongPassword = await anonymous.mutate<SignInData>("signIn", {
            variables: { input: { email, password: "definitely-not-the-password" } },
        })
        const unknownEmail = await anonymous.mutate<SignInData>("signIn", {
            variables: { input: { email: `nobody-${randomUUID()}@todo.dev`, password: "whatever" } },
        })
        expect(wrongPassword.errorCode).toBe("SESSION_INVALID_CREDENTIALS")
        expect(unknownEmail.errorCode).toBe("SESSION_INVALID_CREDENTIALS")
        expect(wrongPassword.data).toBeNull()
        expect(JSON.stringify(unknownEmail.errors)).toBe(JSON.stringify(wrongPassword.errors))

        // The display text follows the caller language (default vi); the code never changes.
        const signInBody = { query: GRAPHQL_DOCUMENTS.signIn, variables: { input: { email, password: "definitely-not-the-password" } } }
        const english = await world.http().post<GraphqlErrorBody>("/graphql", signInBody, { headers: { "accept-language": "en" } })
        const vietnamese = await world.http().post<GraphqlErrorBody>("/graphql", signInBody)
        expect(english.body.errors?.[0]?.extensions?.code).toBe("SESSION_INVALID_CREDENTIALS")
        expect(english.body.errors?.[0]?.message).toBe("The email or password is incorrect.")
        expect(vietnamese.body.errors?.[0]?.extensions?.code).toBe("SESSION_INVALID_CREDENTIALS")
        expect(vietnamese.body.errors?.[0]?.message).not.toBe(english.body.errors?.[0]?.message)

        // The account is deleted through the realm admin door: the pair stops working, the proof is public.
        await auth.deleteAccount(account.personId)
        const afterDelete = await anonymous.mutate<SignInData>("signIn", { variables: { input: { email, password } } })
        expect(afterDelete.errorCode).toBe("SESSION_INVALID_CREDENTIALS")
    })
})
