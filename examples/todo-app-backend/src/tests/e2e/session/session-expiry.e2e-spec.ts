import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import type { TasksData } from "../setup/e2e-views.contracts"

/**
 * Session expiry end to end (the api exposes no token-refresh door, so expiry is the session terminal journey). Expiry is
 * enforced on read, not by a sweeper: an expires_at in the past makes the next bearer call SESSION_EXPIRED. No public
 * operation can age a session, so that one precondition is created out-of-band in Postgres; the behavior under test (refuse,
 * then recover through a fresh sign-in) travels the real /graphql door. The lapsed row is left for the worker purge job
 * to remove, and the spec observes that through the database.
 */
describe("session expiry (e2e)", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("session/session-expiry")
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        await world.close()
        // Teardown asserted: closing the world ran compose down -v and verified no container or volume of this run remains.
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("live session -> expiry passes -> SESSION_EXPIRED -> re-sign-in recovers", async () => {
        const { graphql, auth, database } = world
        const { sessionToken, personId } = await auth.persona("owner")
        const asSession = graphql.client(sessionToken)

        const live = await asSession.read<TasksData>("tasks")
        expect(live.errors).toBeNull()

        expect(await database.expireSession(sessionToken)).toBe(1)

        const expired = await asSession.read<TasksData>("tasks")
        expect(expired.errorCode).toBe("SESSION_EXPIRED")
        expect(expired.data).toBeNull()

        const recovered = await auth.signInAs("owner")
        expect(recovered.personId).toBe(personId)
        expect(recovered.sessionToken).not.toBe(sessionToken)
        const relisted = await graphql.client(recovered.sessionToken).read<TasksData>("tasks")
        expect(relisted.errors).toBeNull()
    })
})
