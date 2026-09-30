import { SessionErrorCode } from "@modules/domain/session"
import { EXPIRE_SESSION } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { TasksData } from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/test-world.service"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"

/**
 * Session expiry end to end (the api exposes no token-refresh door, so expiry is the session terminal journey). Expiry is
 * enforced on read, not by a sweeper: an expires_at in the past makes the next bearer call SESSION_EXPIRED. No public
 * operation can age a session, so that one precondition is created out-of-band through the shared entity manager; the
 * behavior under test (refuse, then recover through a fresh sign-in) travels the real /graphql door.
 */
describe("session expiry (e2e)", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true } } })

    it("live session -> expiry passes -> SESSION_EXPIRED -> re-sign-in recovers", async () => {
        const { api } = world.apps.todo
        const person = await world.signedInPerson("expiry")

        const live = await person.caller.graphql<TasksData>("tasks")
        expect(live.errors).toBeNull()

        // An UPDATE answers `[rows, rowCount]` even with RETURNING.
        const [, touched]: [Array<object>, number] = await world.db.primary.query(EXPIRE_SESSION, [person.sessionToken])
        expect(touched).toBe(1)

        const expired = await person.caller.graphql<TasksData>("tasks")
        expect(expired.errorCode).toBe(SessionErrorCode.Expired)
        expect(expired.data).toBeNull()

        const recovered = await api.signIn(person.email, person.password)
        expect(recovered.personId).toBe(person.personId)
        expect(recovered.sessionToken).not.toBe(person.sessionToken)
        const relisted = await api.as(recovered.sessionToken).graphql<TasksData>("tasks")
        expect(relisted.errors).toBeNull()
    })
})
