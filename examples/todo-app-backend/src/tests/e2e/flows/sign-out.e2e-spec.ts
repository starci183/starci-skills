import { SessionErrorCode } from "@modules/domain/session"
import { SESSION_COUNT_BY_TOKEN } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { CountRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type { SignOutData, TasksData } from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/test-world.service"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"

/**
 * session/sign-out end to end: a session that answers calls ends by its own token through the public signOut door (the
 * session row is deleted, so the next bearer read is SESSION_NOT_FOUND and a second signOut refuses the same way), and
 * the same identity recovers with a fresh sign-in. The identity provider is told the session ended (the fake records the
 * notice); the row counts are read through the shared entity manager, every step of the journey itself travels /graphql.
 */
describe("session sign-out (e2e)", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true } } })

    const sessionCount = async (token: string): Promise<number> => {
        const [row]: Array<CountRow> = await world.db.primary.query(SESSION_COUNT_BY_TOKEN, [token])
        return row?.count ?? 0
    }

    it("sign-in -> session serves calls -> sign-out -> token refused and row gone -> re-sign-in recovers", async () => {
        const { api } = world.apps.todo
        const person = await world.signedInPerson("sign-out")

        const live = await person.caller.graphql<TasksData>("tasks")
        expect(live.errors).toBeNull()
        expect(Array.isArray(live.data?.tasks)).toBe(true)
        expect(await sessionCount(person.sessionToken)).toBe(1)

        const signedOut = await api.graphql<SignOutData>("signOut", { input: { sessionToken: person.sessionToken } })
        expect(signedOut.errors).toBeNull()
        expect(signedOut.data?.signOut.signedOut).toBe(true)

        // The provider was told the session ended: the notice names the person (contract check on what the app sent).
        const notices = (await world.fake.keycloak.requests()).filter((request) => request.body.includes(person.personId))
        expect(notices).toHaveLength(1)
        expect(notices[0]?.body).toContain("sign-out")

        const refused = await person.caller.graphql<TasksData>("tasks")
        expect(refused.errorCode).toBe(SessionErrorCode.NotFound)
        expect(refused.data).toBeNull()
        expect(await sessionCount(person.sessionToken)).toBe(0)

        // Revocation is not idempotent at the door: signOut on a dead token is the same refusal a forged or expired one gets.
        const again = await api.graphql<SignOutData>("signOut", { input: { sessionToken: person.sessionToken } })
        expect(again.errorCode).toBe(SessionErrorCode.NotFound)

        const recovered = await api.signIn(person.email, person.password)
        expect(recovered.personId).toBe(person.personId)
        expect(recovered.sessionToken).not.toBe(person.sessionToken)
        const relisted = await api.as(recovered.sessionToken).graphql<TasksData>("tasks")
        expect(relisted.errors).toBeNull()
    })
})
