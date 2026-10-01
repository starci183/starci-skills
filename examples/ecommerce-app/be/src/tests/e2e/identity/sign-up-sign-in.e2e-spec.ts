import { randomUUID } from "node:crypto"
import { present } from "../../fixtures/present.mapper"
import type {
    AccountData,
    RegisterData,
    SignInData,
    VerifySessionData,
    RevokeSessionData,
} from "../../fixtures/e2e-views.contracts"
import { readRows } from "../../fixtures/persistence/e2e-verification.rows"
import { PUBLIC_TABLES, PERSON_BY_ID } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * fr.identity.sign-in as one complete journey over the public doors only: register, a refused duplicate and refused wrong
 * pairs, sign-in, session verification, the account view that itself proves the identity to order hop (hasOrders is read
 * live from the order service with the caller own bearer), revoke, and out-of-band persistence verification. Every
 * refusal is asserted on errors[0].extensions.code, not on an HTTP status.
 *
 * Run: npm run test:e2e -- identity/sign-up-sign-in
 */
describe("identity sign-up and sign-in journey", () => {
    const email = `e2e-${randomUUID()}@ecommerce.dev`
    const password = "e2e-journey-pass-1"

    const world = useTestWorld({ apps: ["identity", "order"] })

    it("registers a person, issues and verifies a session, then revokes it", async () => {
        const anonymous = world.apps.identity.api

        const registered = await anonymous.mutate<RegisterData>("register", {
            variables: { input: { email, password } },
        })
        expect(registered.errorCode).toBeNull()
        const personId = present(registered.data, "register data").register.personId

        const taken = await anonymous.mutate<RegisterData>("register", { variables: { input: { email, password } } })
        expect(taken.errorCode).toBe("ACCOUNT_EMAIL_TAKEN")
        expect(taken.errors?.[0]?.extensions).toMatchObject({ code: "ACCOUNT_EMAIL_TAKEN", kind: "conflict" })

        // A weak password never reaches the account capability: the global validation pipe refuses it by field.
        const weak = await anonymous.mutate<RegisterData>("register", {
            variables: { input: { email: `weak-${email}`, password: "short" } },
        })
        expect(weak.errorCode).toBe("HTTP_SECURITY_REQUEST_INVALID")

        // The refusal names neither half of the pair: a wrong password and an unknown email are the same answer.
        const wrongPassword = await anonymous.mutate<SignInData>("signIn", {
            variables: { input: { email, password: "not-the-password" } },
        })
        const unknownEmail = await anonymous.mutate<SignInData>("signIn", {
            variables: { input: { email: `ghost-${email}`, password } },
        })
        expect(wrongPassword.errorCode).toBe("ACCOUNT_INVALID_CREDENTIALS")
        expect(unknownEmail.errorCode).toBe(wrongPassword.errorCode)
        expect(unknownEmail.errorMessage).toBe(wrongPassword.errorMessage)

        const signedIn = await anonymous.mutate<SignInData>("signIn", { variables: { input: { email, password } } })
        expect(signedIn.errorCode).toBeNull()
        const session = present(signedIn.data, "signIn data").signIn
        expect(session.personId).toBe(personId)

        // verifySession is the handshake the order service uses; it is anonymous by design (AuthHandshake).
        const verified = await anonymous.read<VerifySessionData>("verifySession", {
            variables: { input: { sessionToken: session.sessionToken } },
        })
        expect(verified.errorCode).toBeNull()
        expect(verified.data?.verifySession.personId).toBe(personId)

        // The account view is the cross-service proof: identity reads hasOrders live from order, forwarding the caller token.
        const caller = world.apps.identity.api.bearing(session.sessionToken)
        const account = await caller.read<AccountData>("account")
        expect(account.errorCode).toBeNull()
        expect(account.data?.account).toEqual({ personId, email, hasOrders: false })

        // The account door is default-deny: without a live session it is refused.
        const denied = await anonymous.read<AccountData>("account")
        expect(denied.errorCode).toBe("IDENTITY_UNAUTHENTICATED")

        // Out-of-band verification: the person persisted, and both databases carry their migrated tables.
        expect(await readRows(world.db.identity, PERSON_BY_ID, [personId])).toEqual([{ id: personId, email }])
        expect(await world.infra.redis.size()).toBeGreaterThan(0)
        const identityTables = await readRows(world.db.identity, PUBLIC_TABLES, [])
        const orderTables = await readRows(world.db.order, PUBLIC_TABLES, [])
        expect([...identityTables, ...orderTables].map((row) => row.table_name)).toEqual(
            expect.arrayContaining(["persons", "products", "orders"]),
        )

        const revoked = await caller.mutate<RevokeSessionData>("revokeSession", {
            variables: { input: { sessionToken: session.sessionToken } },
        })
        expect(revoked.errorCode).toBeNull()
        expect(revoked.data?.revokeSession.revoked).toBe(true)

        const afterRevoke = await anonymous.read<VerifySessionData>("verifySession", {
            variables: { input: { sessionToken: session.sessionToken } },
        })
        expect(afterRevoke.errorCode).toBe("SESSION_INVALID")
        const accountAfter = await caller.read<AccountData>("account")
        expect(accountAfter.errorCode).toBe("IDENTITY_UNAUTHENTICATED")
    })
})
