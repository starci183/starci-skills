import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { present } from "../setup/e2e.error"
import type { SignOutData, TasksData } from "../setup/e2e-views.contracts"

/**
 * session/sign-out end to end: a session that answers calls ends by its own token through the public signOut door (the
 * session row is deleted, so the next bearer read is SESSION_NOT_FOUND and a second signOut refuses the same way), and
 * the same identity recovers with a fresh sign-in. The Postgres reads are out-of-band verification only: every step of the
 * journey itself travels the real /graphql door.
 */
describe("session sign-out (e2e)", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("session/sign-out")
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        await world.close()
        // Teardown asserted: closing the world ran compose down -v and verified no container or volume of this run remains.
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("sign-in -> session serves calls -> sign-out -> token refused and row gone -> re-sign-in recovers", async () => {
        const { graphql, auth, database } = world
        const { sessionToken, personId } = await auth.persona("owner")
        const asSession = graphql.client(sessionToken)

        const live = await asSession.read<TasksData>("tasks")
        expect(live.errors).toBeNull()
        expect(Array.isArray(live.data?.tasks)).toBe(true)
        expect(await database.sessionCountByToken(sessionToken)).toBe(1)

        const signedOut = await graphql.client().mutate<SignOutData>("signOut", { variables: { input: { sessionToken } } })
        expect(signedOut.errors).toBeNull()
        expect(present(signedOut.data, "signOut data").signOut.signedOut).toBe(true)

        const refused = await asSession.read<TasksData>("tasks")
        expect(refused.errorCode).toBe("SESSION_NOT_FOUND")
        expect(refused.data).toBeNull()
        expect(await database.sessionCountByToken(sessionToken)).toBe(0)

        // Revocation is not idempotent at the door: signOut on a dead token is the same refusal a forged or expired one gets.
        const again = await graphql.client().mutate<SignOutData>("signOut", { variables: { input: { sessionToken } } })
        expect(again.errorCode).toBe("SESSION_NOT_FOUND")

        const recovered = await auth.signInAs("owner")
        expect(recovered.personId).toBe(personId)
        expect(recovered.sessionToken).not.toBe(sessionToken)
        const relisted = await graphql.client(recovered.sessionToken).read<TasksData>("tasks")
        expect(relisted.errors).toBeNull()
    })
})
