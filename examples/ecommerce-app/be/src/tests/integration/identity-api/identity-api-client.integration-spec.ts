import { randomUUID } from "node:crypto"
import { IDENTITY_API, IdentityApiErrorCode } from "@modules/integrations/identity-api"
import type { IdentityApiClient } from "@modules/integrations/identity-api"
import { IDENTITY_API_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/**
 * identity-api: the order app's real client of the identity service against the real identity app the world boots beside
 * it, no fake in between. A live session verifies to its person and an unknown one to nothing; the health probe answers
 * while the service is up. An identity service that is down is the declared unavailable refusal for both, and the client
 * is served again once the service is back.
 */
describe("identity-api: identity service client (integration)", () => {
    const world = useTestWorld({ modules: IDENTITY_API_CAPABILITY_MODULES, apps: ["identity", "order"] })

    const identityApi = (): IdentityApiClient => world.resolve<IdentityApiClient>(IDENTITY_API)

    it("verifies a live session to its person and an unknown session to nothing", async () => {
        const person = await world.signedInPerson("identity-api")

        expect(await identityApi().verify(person.sessionToken)).toEqual({ personId: person.personId })
        expect(await identityApi().verify(`unknown-${randomUUID()}`)).toBeNull()
        await expect(identityApi().check()).resolves.toBeUndefined()
    })

    it("an identity service that is down is the declared unavailable refusal, and the client is served again once it is back", async () => {
        const person = await world.signedInPerson("identity-api-outage")

        await world.apps.identity.during(async () => {
            await expect(identityApi().verify(person.sessionToken)).rejects.toMatchObject({
                code: IdentityApiErrorCode.Unavailable,
            })
            await expect(identityApi().check()).rejects.toMatchObject({ code: IdentityApiErrorCode.Unavailable })
        })

        expect(await identityApi().verify(person.sessionToken)).toEqual({ personId: person.personId })
    })
})
