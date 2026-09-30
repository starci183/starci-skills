import { Test } from "@nestjs/testing"
import { fakeCache, FakeClock, mock } from "@starci/jest-preset"
import { CACHE } from "@modules/integrations/cache"
import { KEYCLOAK_ADMIN, KeycloakAdminErrorCode } from "@modules/integrations/keycloak-admin"
import type { KeycloakAdmin, KeycloakMember } from "@modules/integrations/keycloak-admin"
import { ok, refused } from "@modules/platform/primitives"
import { MemberProfileService } from "./member-profile.service"
import type { MemberProfile } from "./member.contracts"

const member: KeycloakMember = { id: "m-1", email: "an@shop.test", displayName: "An" }
const profile: MemberProfile = { memberId: "m-1", email: "an@shop.test", displayName: "An" }
const ENTRY = "member.profile:m-1"

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const cache = fakeCache(clock)
    const keycloak = mock<KeycloakAdmin>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MemberProfileService,
            { provide: CACHE, useValue: cache },
            { provide: KEYCLOAK_ADMIN, useValue: keycloak },
        ],
    }).compile()
    return { service: moduleRef.get(MemberProfileService), clock, cache, keycloak }
}

describe("MemberProfileService", () => {
    describe("profile", () => {
        it("reads Keycloak once on a cache miss and caches the profile for 300 seconds", async () => {
            const { service, cache, keycloak } = await build()
            keycloak.findMember.mockResolvedValue(ok(member))

            await expect(service.profile({ memberId: "m-1" })).resolves.toSucceedWith(profile)

            expect(keycloak.findMember).toHaveBeenCalledTimes(1)
            expect(keycloak.findMember).toHaveBeenCalledWith("m-1")
            expect(cache.has(ENTRY)).toBe(true)
            expect(cache.ttlOf(ENTRY)).toBe(300)
        })

        it("cache hit does not call Keycloak", async () => {
            const { service, keycloak } = await build()
            keycloak.findMember.mockResolvedValue(ok(member))
            await service.profile({ memberId: "m-1" })
            keycloak.findMember.mockClear()

            await expect(service.profile({ memberId: "m-1" })).resolves.toSucceedWith(profile)

            expect(keycloak.findMember).not.toHaveBeenCalled()
        })

        it("reads Keycloak again once the cached profile expired", async () => {
            const { service, clock, cache, keycloak } = await build()
            keycloak.findMember.mockResolvedValue(ok(member))
            await service.profile({ memberId: "m-1" })

            clock.advance(300_000)
            expect(cache.has(ENTRY)).toBe(false)
            await expect(service.profile({ memberId: "m-1" })).resolves.toSucceedWith(profile)

            expect(keycloak.findMember).toHaveBeenCalledTimes(2)
            expect(cache.ttlOf(ENTRY)).toBe(300)
        })

        it("refuses a missing member and does not cache the refusal", async () => {
            const { service, cache, keycloak } = await build()
            keycloak.findMember.mockResolvedValue(refused(KeycloakAdminErrorCode.MemberMissing, { memberId: "m-1" }))

            await expect(service.profile({ memberId: "m-1" })).resolves.toBeRefused(
                KeycloakAdminErrorCode.MemberMissing,
            )

            expect(cache.has(ENTRY)).toBe(false)
            expect(cache.keys()).toEqual([])
        })

        it("refuses when the identity provider is unavailable and does not cache the refusal", async () => {
            const { service, cache, keycloak } = await build()
            keycloak.findMember.mockResolvedValue(refused(KeycloakAdminErrorCode.Unavailable))

            await expect(service.profile({ memberId: "m-1" })).resolves.toBeRefused(KeycloakAdminErrorCode.Unavailable)

            expect(cache.has(ENTRY)).toBe(false)
        })

        it("keeps one entry per member", async () => {
            const { service, cache, keycloak } = await build()
            keycloak.findMember.mockResolvedValueOnce(ok(member))
            keycloak.findMember.mockResolvedValueOnce(ok({ id: "m-2", email: "bo@shop.test", displayName: "Bo" }))

            await service.profile({ memberId: "m-1" })
            await service.profile({ memberId: "m-2" })

            expect(cache.keys()).toEqual(["member.profile:m-1", "member.profile:m-2"])
        })
    })
})
