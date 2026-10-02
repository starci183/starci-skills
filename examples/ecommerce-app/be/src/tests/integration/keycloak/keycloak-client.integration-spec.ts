import { fakeIds } from "@starci/jest-preset"
import { KEYCLOAK, KeycloakErrorCode } from "@modules/integrations/keycloak"
import type { KeycloakClient } from "@modules/integrations/keycloak"
import { KEYCLOAK_SIGN_IN_CLIENT } from "../../world/test-apps.options"
import { KEYCLOAK_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/** The ids of the rows and keys this spec arranges: deterministic, so a failing run reproduces. */
const ids = fakeIds()

/**
 * keycloak: the real identity provider client against the real realm of the stack, no HTTP door of ours. A registered person
 * signs in with the password grant and the client reads the subject and the refresh token the realm issued; signing out
 * ends the realm session. A wrong password is the declared invalid-credentials refusal; a realm that cannot be reached is
 * the declared provider-unavailable refusal, and the client works again once the realm answers.
 */
describe("keycloak: identity provider client (integration)", () => {
    const world = useTestWorld({ modules: KEYCLOAK_CAPABILITY_MODULES })

    const client = (): KeycloakClient => world.resolve<KeycloakClient>(KEYCLOAK)

    it("signs a registered person in, reads the subject and the refresh token, and ends the session on sign-out", async () => {
        const email = `kc-${ids.next()}@ecommerce.dev`
        const password = `pw-${ids.next()}`
        const personId = await world.keycloak.person(email, password)

        const signedIn = await client().signIn({ email, password })
        expect(signedIn.subject).toBe(personId)
        expect(signedIn.refreshToken).not.toBe("")
        const live = await world.keycloak.sessions(personId)
        expect(live.some((session) => session.clientIds.includes(KEYCLOAK_SIGN_IN_CLIENT))).toBe(true)

        await client().notifySignOut({ refreshToken: signedIn.refreshToken })
        const ended = await world.waitUntil(
            "the realm ends the session of the person",
            () => world.keycloak.sessions(personId),
            (sessions) => sessions.length === 0,
        )
        expect(ended).toEqual([])
    })

    it("a wrong password is the declared invalid-credentials refusal", async () => {
        const email = `kc-${ids.next()}@ecommerce.dev`
        await world.keycloak.person(email, `pw-${ids.next()}`)

        await expect(client().signIn({ email, password: `wrong-${ids.next()}` })).rejects.toMatchObject({
            code: KeycloakErrorCode.InvalidCredentials,
        })
    })

    it("an unreachable realm is the declared provider-unavailable refusal, and the client recovers with the realm", async () => {
        const email = `kc-${ids.next()}@ecommerce.dev`
        const password = `pw-${ids.next()}`
        const personId = await world.keycloak.person(email, password)

        await world.infra.keycloak.during(async () => {
            await expect(client().signIn({ email, password })).rejects.toMatchObject({
                code: KeycloakErrorCode.ProviderUnavailable,
            })
        })

        expect((await client().signIn({ email, password })).subject).toBe(personId)
    })
})
