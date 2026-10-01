import { IdentityErrorCode } from "@modules/domain/identity"
import { SESSION_COUNT_BY_TOKEN } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { CountRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type { SignOutData, TasksData } from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/use-test-world"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"

/**
 * session/sign-out end to end: a session that answers calls ends by its own token through the public signOut door (the
 * session row is deleted, so the next bearer read is SESSION_NOT_FOUND and a second signOut refuses the same way), and
 * the same identity recovers with a fresh sign-in against the run's real Keycloak, which has ended its own session of the
 * person (a LOGOUT event, and no live session of the api's client any more). The row counts are read through the shared entity
 * manager, every step of the journey itself travels /graphql.
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

        // The sign-in opened a provider session of the person through the api's client.
        const { keycloak } = world.infra
        const liveThroughApi = async (personId: string): Promise<boolean> =>
            (await keycloak.sessions(personId)).some((session) => session.clientIds.includes(keycloak.clientId))
        expect(await liveThroughApi(person.personId)).toBe(true)

        const signedOut = await api.graphql<SignOutData>("signOut", { input: { sessionToken: person.sessionToken } })
        expect(signedOut.errors).toBeNull()
        expect(signedOut.data?.signOut.signedOut).toBe(true)

        // The identity provider ended the session too: the real Keycloak recorded a LOGOUT of the person and holds no live
        // session of the person through the api's client any more.
        const ended = await world.waitFor("keycloak ends the session of the person", async () => {
            const loggedOut = (await keycloak.events(person.personId)).some((event) => event.type === "LOGOUT")
            const live = await liveThroughApi(person.personId)
            return loggedOut && !live ? { loggedOut, live } : null
        })
        expect(ended).toEqual({ loggedOut: true, live: false })

        const refused = await person.caller.graphql<TasksData>("tasks")
        expect(refused.errorCode).toBe(IdentityErrorCode.NotFound)
        expect(refused.data).toBeNull()
        expect(await sessionCount(person.sessionToken)).toBe(0)

        // Revocation is not idempotent at the door: signOut on a dead token is the same refusal a forged or expired one gets.
        const again = await api.graphql<SignOutData>("signOut", { input: { sessionToken: person.sessionToken } })
        expect(again.errorCode).toBe(IdentityErrorCode.NotFound)

        const recovered = await api.signIn(person.email, person.password)
        expect(recovered.personId).toBe(person.personId)
        expect(recovered.sessionToken).not.toBe(person.sessionToken)
        const relisted = await api.as(recovered.sessionToken).graphql<TasksData>("tasks")
        expect(relisted.errors).toBeNull()
    })
})
