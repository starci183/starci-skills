import { randomUUID } from "node:crypto"
import { KEYCLOAK_ADMIN, KeycloakAdminErrorCode } from "@modules/integrations/keycloak-admin"
import type { KeycloakAdmin } from "@modules/integrations/keycloak-admin"
import { ok, refused } from "@modules/platform/primitives"
import { KEYCLOAK_ADMIN_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/**
 * keycloak-admin: the real admin client against the run's realm of the stack's Keycloak, no HTTP door of ours. It signs in
 * as the service account of the realm's confidential client (client-credentials grant) and reads a registered member; an
 * unknown member is the declared member-missing refusal, and a Keycloak that cannot be reached is the declared unavailable
 * refusal, with the client serving again once Keycloak is back.
 */
describe("keycloak-admin: member directory client (integration)", () => {
    const world = useTestWorld({ modules: KEYCLOAK_ADMIN_CAPABILITY_MODULES })

    const admin = (): KeycloakAdmin => world.resolve<KeycloakAdmin>(KEYCLOAK_ADMIN)

    const registerMember = async (): Promise<{ readonly id: string; readonly email: string }> => {
        const email = `member-${randomUUID()}@ecommerce.dev`
        const id = await world.keycloak.person(email, `pw-${randomUUID()}`)
        return { id, email }
    }

    it("reads a registered member through the service account of the confidential client", async () => {
        const member = await registerMember()

        const found = await admin().findMember(member.id)

        expect(found).toEqual(ok({ id: member.id, email: member.email, displayName: member.email }))
    })

    it("an unknown member is the declared member-missing refusal", async () => {
        const memberId = randomUUID()

        expect(await admin().findMember(memberId)).toEqual(refused(KeycloakAdminErrorCode.MemberMissing, { memberId }))
    })

    it("an unreachable Keycloak is the declared unavailable refusal, and the client serves again once Keycloak is back", async () => {
        const member = await registerMember()

        await world.infra.keycloak.during(async () => {
            expect(await admin().findMember(member.id)).toEqual(refused(KeycloakAdminErrorCode.Unavailable))
        })

        expect((await admin().findMember(member.id)).kind).toBe("ok")
    })
})
