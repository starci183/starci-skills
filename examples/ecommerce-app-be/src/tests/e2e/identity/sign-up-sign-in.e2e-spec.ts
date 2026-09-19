import {
    E2EWorld, bootE2eWorld 
} from "@tests/infra/e2e-world"
import {
    E2EDbService 
} from "@tests/infra/platform/databases/e2e-db.service"
import {
    E2EHttpService 
} from "@tests/infra/integrations/http/e2e-http.service"
import {
    E2EGraphqlService 
} from "@tests/infra/integrations/graphql/e2e-graphql.service"
import {
    E2EStackService 
} from "@tests/infra/platform/stack/e2e-stack.service"

/** The register mutation's payload. */
interface RegisterPayload { personId: string }

/** The register mutation's data envelope. */
interface RegisterData { register: RegisterPayload }

/** The signIn mutation's payload. */
interface SignInPayload { sessionToken: string; personId: string }

/** The signIn mutation's data envelope. */
interface SignInData { signIn: SignInPayload }

/** The account query's payload: the person joined with live buyer status. */
interface AccountPayload { personId: string; email: string; hasOrders: boolean }

/** The account query's data envelope. */
interface AccountData { account: AccountPayload }

/**
 * Exemplar for the e2e contract: fr.identity.sign-in as one complete A->Z journey over the public
 * doors only - register, refused duplicates and wrong pairs, sign-in, session verify, the
 * account view that itself proves the identity->order hop (hasOrders is read live from the order
 * service), revoke, and out-of-band persistence/cleanup verification.
 *
 * The user-facing doors are GraphQL now: register, signIn and account travel as real operations
 * to identity's /graphql, and every refusal is asserted on errors[0].extensions.code carrying
 * the business code (EMAIL_TAKEN, INVALID_CREDENTIALS - the `_EXCEPTION` transport suffix stays
 * inside the exception class) - not on an HTTP status. Only the justified machine doors
 * (/internal/sessions/*) and the /health probe still ride plain HTTP.
 *
 * Run: npx jest --config test/e2e/jest.config.js test/e2e/identity/sign-up-sign-in.e2e-spec.ts
 */
describe("identity sign-up → sign-in journey",
    () => {
        let world: E2EWorld
        let stack: E2EStackService
        let http: E2EHttpService
        let graphql: E2EGraphqlService
        let dataSource: E2EDbService

        const email = `e2e-${Date.now()}@ecommerce.dev`
        const password = "e2e-journey-pass-1"

        beforeAll(async () => {
            world = await bootE2eWorld("identity/sign-up-sign-in")
            stack = world.stack
            http = world.http
            graphql = world.graphql
            dataSource = world.dataSource
        },
        300_000)

        afterAll(async () => {
            await world.moduleRef.close()
            // Teardown verification is part of the contract: this run's containers and volumes must be gone.
            expect(stack.cleanupReport).not.toBeNull()
            expect(stack.cleanupReport?.clean).toBe(true)
        })

        it("registers a person, issues and verifies a session, then revokes it",
            async () => {
                const identity = http.client("identity")
                const identityGql = graphql.client("identity")

                // Dependency ordering, observed: the stack could only reach this point with postgres+redis
                // healthy and identity's /health answering before order was ever spawned.
                expect(stack.readiness.map((r) => r.label)).toEqual([
                    "postgres:5432",
                    "redis:6379",
                    expect.stringContaining("identity /health"),
                    expect.stringContaining("order /health"),
                ])

                const registered = await identityGql.mutate<RegisterData>("register",
                    {
                        variables: {
                            input: {
                                email, password 
                            } 
                        } 
                    })
                expect(registered.errorCode).toBeNull()
                expect(registered.data?.register.personId).toBeTruthy()
                const personId = registered.data!.register.personId

                const taken = await identityGql.mutate<RegisterData>("register",
                    {
                        variables: {
                            input: {
                                email, password 
                            } 
                        } 
                    })
                expect(taken.errorCode).toBe("EMAIL_TAKEN")
                expect(taken.errors?.[0]?.extensions?.code).toBe("EMAIL_TAKEN")

                const wrongPair = await identityGql.mutate<SignInData>("signIn",
                    {
                        variables: {
                            input: {
                                email, password: "not-the-password" 
                            } 
                        } 
                    })
                expect(wrongPair.errorCode).toBe("INVALID_CREDENTIALS")
                // A refusal may name the pair or neither half, but it must not single one out:
                // no "unknown email", no "wrong password".
                expect(wrongPair.errorMessage ?? "").not.toMatch(/unknown|not found|no such|does ?n['’]?t exist|unregistered|no account/i)
                expect(wrongPair.errorMessage ?? "").not.toMatch(/(wrong|incorrect|invalid|bad) (password|passphrase)/i)

                const signedIn = await identityGql.mutate<SignInData>("signIn",
                    {
                        variables: {
                            input: {
                                email, password 
                            } 
                        } 
                    })
                expect(signedIn.errorCode).toBeNull()
                expect(signedIn.data?.signIn.personId).toBe(personId)
                const { sessionToken } = signedIn.data!.signIn

                // The session surface stays REST: it is a machine door order verifies against, not a
                // user-facing API - the lint rule's sanctioned "internal" reason.
                const verified = await identity.post<{ personId: string }>("/internal/sessions/verify",
                    {
                        sessionToken 
                    })
                expect(verified.status).toBe(201)
                expect(verified.body.personId).toBe(personId)

                // The account view is the cross-service proof: identity reads hasOrders live from order's
                // GET /internal/buyers/:personId. A brand-new person is not a buyer yet - a reachable order answers so.
                const account = await identityGql.query<AccountData>("account",
                    {
                        variables: {
                            personId 
                        } 
                    })
                expect(account.errorCode).toBeNull()
                expect(account.data?.account).toEqual({
                    personId, email, hasOrders: false 
                })

                // Out-of-band verification: the person really persisted on this run's postgres volume, and
                // both services' migration sets ran on it.
                const rows = await dataSource.query<{ id: string; email: string }>("select id, email from identity_person where id = $1",
                    [personId])
                expect(rows).toEqual([{
                    id: personId, email 
                }])
                const schema = stack.schemaSnapshot()
                expect(schema.tables).toEqual(expect.arrayContaining(["identity_person",
                    "product",
                    "sales_order"]))

                const revoked = await identity.post<{ revoked: boolean }>("/internal/sessions/revoke",
                    {
                        sessionToken 
                    })
                expect(revoked.status).toBe(201)
                expect(revoked.body.revoked).toBe(true)

                const afterRevoke = await identity.post<{ code?: string }>("/internal/sessions/verify",
                    {
                        sessionToken 
                    })
                expect(afterRevoke.status).toBe(401)
                expect(afterRevoke.body.code).toBe("SESSION_INVALID")
            })
    })
