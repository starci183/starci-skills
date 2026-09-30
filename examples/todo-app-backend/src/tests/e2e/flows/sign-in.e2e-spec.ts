import { randomUUID } from "node:crypto"
import { SessionErrorCode } from "@modules/domain/session"
import { SESSION_BY_TOKEN } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { SessionRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type { CreateTaskData, SignInData, TasksData } from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/test-world.service"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"

const WRONG_PASSWORD = "definitely-not-the-password"

/**
 * auth/sign-in: one complete journey through the public GraphQL door. A person known to the identity provider signs in
 * twice and uses the session it grants; the refusal contract holds (declared code on `errors[].extensions.code`, the same
 * answer for a wrong password and an unknown email, display text localized by the caller language); an identity provider
 * that goes silent is a declared provider-unavailable refusal, not a hang. The identity provider is a fake at the network
 * edge, so the real Keycloak client (form, deadline, token parsing) runs; the fake records the calls for the contract check.
 * Persisted state is read back through the shared entity manager.
 */
describe("auth/sign-in", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true } } })

    it("sign in -> use session -> refuse wrong pairs -> localized refusal -> provider silent is a declared refusal", async () => {
        const { api } = world.apps.todo
        const email = `e2e-${randomUUID()}@todo.dev`
        const password = "e2e-pass-1"
        const personId = await world.fake.keycloak.person(email, password)

        const first = await api.signIn(email, password)
        // A person is the identity provider subject: stable across sign-ins, never a bare email.
        expect(first.personId).toBe(personId)

        // The real client asked the provider the way a password grant is asked.
        const requests = await world.fake.keycloak.requests()
        const grant = requests.find((request) => request.method === "POST" && request.body.includes(encodeURIComponent(email)))
        expect(grant?.path).toBe("/realms/todo/protocol/openid-connect/token")
        expect(grant?.body).toContain("grant_type=password")

        // The session the door handed out is a real row of the shared database.
        const sessionRows: Array<SessionRow> = await world.db.primary.query(SESSION_BY_TOKEN, [first.sessionToken])
        expect(sessionRows).toEqual([{ token: first.sessionToken, person_id: first.personId }])

        // The session grants access: a task created through it is read back out of the caller's list.
        const caller = api.as(first.sessionToken)
        const title = `e2e:sign-in:${randomUUID()}`
        const created = await caller.graphql<CreateTaskData>("createTask", { input: { title } })
        expect(created.errorCode).toBeNull()
        const taskId = created.data?.createTask.taskId
        const listed = await caller.graphql<TasksData>("tasks")
        expect(listed.errors).toBeNull()
        expect(listed.data?.tasks.find((task) => task.taskId === taskId)?.title).toBe(title)

        // The list is the signer's own: another person's session never contains this task.
        const stranger = await world.signedInPerson("stranger")
        const strangerList = await stranger.caller.graphql<TasksData>("tasks")
        expect(strangerList.data?.tasks.map((task) => task.taskId)).not.toContain(taskId)

        // The same pair again: same person, a different session, and the first session stays live.
        const second = await api.signIn(email, password)
        expect(second.personId).toBe(first.personId)
        expect(second.sessionToken).not.toBe(first.sessionToken)
        expect((await caller.graphql<TasksData>("tasks")).errorCode).toBeNull()

        // Every door but the public ones is default-deny: without a live session the call is refused.
        const denied = await api.graphql<TasksData>("tasks")
        expect(denied.errorCode).toBe(SessionErrorCode.NotFound)
        expect(denied.data).toBeNull()

        // A wrong pair is refused without naming which half: an unknown email and a wrong password are the identical refusal.
        const wrongPassword = await api.graphql<SignInData>("signIn", { input: { email, password: WRONG_PASSWORD } })
        const unknownEmail = await api.graphql<SignInData>("signIn", { input: { email: `nobody-${randomUUID()}@todo.dev`, password: "whatever" } })
        expect(wrongPassword.errorCode).toBe(SessionErrorCode.InvalidCredentials)
        expect(unknownEmail.errorCode).toBe(SessionErrorCode.InvalidCredentials)
        expect(wrongPassword.data).toBeNull()
        expect(JSON.stringify(unknownEmail.errors)).toBe(JSON.stringify(wrongPassword.errors))

        // The display text follows the caller language (default vi); the code never changes.
        const english = await api.graphql<SignInData>("signIn", { input: { email, password: WRONG_PASSWORD } }, "en")
        const vietnamese = await api.graphql<SignInData>("signIn", { input: { email, password: WRONG_PASSWORD } })
        expect(english.errorCode).toBe(SessionErrorCode.InvalidCredentials)
        expect(english.errorMessage).toBe("The email or password is incorrect.")
        expect(vietnamese.errorCode).toBe(SessionErrorCode.InvalidCredentials)
        expect(vietnamese.errorMessage).not.toBe(english.errorMessage)

        // An identity provider that never answers runs the client into its own deadline: a declared refusal, and the door recovers.
        await world.fake.keycloak.failNext({ timeout: true })
        const silent = await api.graphql<SignInData>("signIn", { input: { email, password } })
        expect(silent.errorCode).toBe(SessionErrorCode.ProviderUnavailable)
        expect((await api.signIn(email, password)).personId).toBe(personId)
    })
})
