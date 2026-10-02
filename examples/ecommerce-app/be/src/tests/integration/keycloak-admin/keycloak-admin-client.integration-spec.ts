import { fakeIds } from "@starci/jest-preset"
import { KEYCLOAK_ADMIN, KeycloakAdminErrorCode } from "@modules/integrations/keycloak-admin"
import type { KeycloakAdmin } from "@modules/integrations/keycloak-admin"
import { refused } from "@modules/platform/primitives"
import { KEYCLOAK_ADMIN_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/** The ids of the rows and keys this spec arranges: deterministic, so a failing run reproduces. */
const ids = fakeIds()

/**
 * keycloak-admin: the real admin client against the run's realm of the stack's Keycloak, no HTTP door of ours. It writes as
 * the service account of the realm's confidential client (client-credentials grant): a created shopper signs in to the realm
 * with the password it was given, and the subject it answers is the realm's. An email the realm already holds is the
 * declared email-taken refusal, and a Keycloak that cannot be reached is the declared unavailable refusal, with the client
 * writing again once Keycloak is back.
 */
describe("keycloak-admin: shopper directory client (integration)", () => {
    const world = useTestWorld({ modules: KEYCLOAK_ADMIN_CAPABILITY_MODULES })

    const admin = (): KeycloakAdmin => world.resolve<KeycloakAdmin>(KEYCLOAK_ADMIN)
    const shopper = () => ({ email: `shopper-${ids.next()}@ecommerce.dev`, password: `pw-${ids.next()}` })

    it("creates a shopper that signs in to the realm with its password", async () => {
        const params = shopper()

        const created = await admin().createMember(params)

        expect(created).toEqual({ kind: "ok", value: { id: expect.any(String) } })
        const memberId = created.kind === "ok" ? created.value.id : ""

        // The realm vouches for the password, and the LOGIN it records belongs to the subject the client answered.
        expect(await world.keycloak.token(params.email, params.password)).not.toBe("")
        const login = await world.waitFor("the realm records the LOGIN of the created shopper", async () =>
            (await world.keycloak.events(memberId)).find((event) => event.type === "LOGIN"),
        )
        expect(login.userId).toBe(memberId)
    })

    it("an email the realm already holds is the declared email-taken refusal", async () => {
        const params = shopper()
        await admin().createMember(params)

        expect(await admin().createMember({ ...params, password: `pw-${ids.next()}` })).toEqual(
            refused(KeycloakAdminErrorCode.EmailTaken),
        )
    })

    it("an unreachable Keycloak is the declared unavailable refusal, and the client writes again once Keycloak is back", async () => {
        await world.infra.keycloak.during(async () => {
            expect(await admin().createMember(shopper())).toEqual(refused(KeycloakAdminErrorCode.Unavailable))
        })

        expect((await admin().createMember(shopper())).kind).toBe("ok")
    })
})
