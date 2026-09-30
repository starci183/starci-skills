import { randomUUID } from "node:crypto"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { present } from "../setup/e2e.error"
import type {
    AccountData,
    RegisterData,
    RevokeSessionData,
    SignInData,
    VerifySessionData,
} from "../setup/e2e-views.contracts"

/**
 * fr.identity.sign-in as one complete journey over the public doors only: register, a refused duplicate and refused wrong
 * pairs, sign-in, session verification, the account view that itself proves the identity to order hop (hasOrders is read
 * live from the order service with the caller own bearer), revoke, and out-of-band persistence verification. Every
 * refusal is asserted on errors[0].extensions.code, not on an HTTP status.
 *
 * Run: npm run test:e2e -- identity/sign-up-sign-in
 */
describe("identity sign-up and sign-in journey", () => {
    let world: E2EWorld
    const email = `e2e-${randomUUID()}@ecommerce.dev`
    const password = "e2e-journey-pass-1"

    beforeAll(async () => {
        world = await bootE2eWorld("identity/sign-up-sign-in")
    }, 300_000)

    afterAll(async () => {
        await world.close()
        // Teardown verification is part of the contract: this run containers and volumes must be gone.
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("registers a person, issues and verifies a session, then revokes it", async () => {
        const anonymous = world.graphql.client("identity")

        // Dependency ordering, observed: the stack reached this point with postgres and redis ready and identity
        // answering /health before order was ever spawned.
        expect(world.stack.readiness.map((step) => step.label)).toEqual(["postgres", "redis", "identity /health", "order /health"])

        const registered = await anonymous.mutate<RegisterData>("register", { variables: { input: { email, password } } })
        expect(registered.errorCode).toBeNull()
        const personId = present(registered.data, "register data").register.personId

        const taken = await anonymous.mutate<RegisterData>("register", { variables: { input: { email, password } } })
        expect(taken.errorCode).toBe("ACCOUNT_EMAIL_TAKEN")
        expect(taken.errors?.[0]?.extensions).toMatchObject({ code: "ACCOUNT_EMAIL_TAKEN", kind: "conflict" })

        // A weak password never reaches the account capability: the global validation pipe refuses it by field.
        const weak = await anonymous.mutate<RegisterData>("register", { variables: { input: { email: `weak-${email}`, password: "short" } } })
        expect(weak.errorCode).toBe("HTTP_SECURITY_REQUEST_INVALID")

        // The refusal names neither half of the pair: a wrong password and an unknown email are the same answer.
        const wrongPassword = await anonymous.mutate<SignInData>("signIn", { variables: { input: { email, password: "not-the-password" } } })
        const unknownEmail = await anonymous.mutate<SignInData>("signIn", { variables: { input: { email: `ghost-${email}`, password } } })
        expect(wrongPassword.errorCode).toBe("ACCOUNT_INVALID_CREDENTIALS")
        expect(unknownEmail.errorCode).toBe(wrongPassword.errorCode)
        expect(unknownEmail.errorMessage).toBe(wrongPassword.errorMessage)

        const signedIn = await anonymous.mutate<SignInData>("signIn", { variables: { input: { email, password } } })
        expect(signedIn.errorCode).toBeNull()
        const session = present(signedIn.data, "signIn data").signIn
        expect(session.personId).toBe(personId)

        // verifySession is the handshake the order service uses; it is anonymous by design (AuthHandshake).
        const verified = await anonymous.read<VerifySessionData>("verifySession", { variables: { input: { sessionToken: session.sessionToken } } })
        expect(verified.errorCode).toBeNull()
        expect(verified.data?.verifySession.personId).toBe(personId)

        // The account view is the cross-service proof: identity reads hasOrders live from order, forwarding the caller token.
        const caller = world.graphql.client("identity", session.sessionToken)
        const account = await caller.read<AccountData>("account")
        expect(account.errorCode).toBeNull()
        expect(account.data?.account).toEqual({ personId, email, hasOrders: false })

        // The account door is default-deny: without a live session it is refused.
        const denied = await anonymous.read<AccountData>("account")
        expect(denied.errorCode).toBe("AUTH_UNAUTHENTICATED")

        // Out-of-band verification: the person persisted, and both databases carry their migrated tables.
        expect(await world.database.personById(personId)).toEqual([{ id: personId, email }])
        expect(await world.database.tables()).toEqual(expect.arrayContaining(["persons", "products", "orders"]))

        const revoked = await caller.mutate<RevokeSessionData>("revokeSession", { variables: { input: { sessionToken: session.sessionToken } } })
        expect(revoked.errorCode).toBeNull()
        expect(revoked.data?.revokeSession.revoked).toBe(true)

        const afterRevoke = await anonymous.read<VerifySessionData>("verifySession", { variables: { input: { sessionToken: session.sessionToken } } })
        expect(afterRevoke.errorCode).toBe("SESSION_INVALID")
        const accountAfter = await caller.read<AccountData>("account")
        expect(accountAfter.errorCode).toBe("AUTH_UNAUTHENTICATED")
    })
})
