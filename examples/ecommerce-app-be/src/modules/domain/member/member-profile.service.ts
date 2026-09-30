import { Injectable } from "@nestjs/common"
import { InjectCache } from "@modules/integrations/cache"
import type { Cache } from "@modules/integrations/cache"
import { InjectKeycloakAdmin } from "@modules/integrations/keycloak-admin"
import type { KeycloakAdmin, KeycloakAdminErrorCode } from "@modules/integrations/keycloak-admin"
import { ok } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { MEMBER_PROFILE_KEY } from "./member.cache-keys"
import type { MemberProfile, MemberProfileParams } from "./member.contracts"

@Injectable()
/**
 * Answers the profile of a member. The cache is asked first; a miss reads the member from the identity provider once and
 * keeps the answer for the time the cache key declares. A refusal of the provider (missing member, provider unavailable) is
 * returned as it is and is never cached, so the next call asks the provider again.
 */
export class MemberProfileService {
    constructor(
        @InjectCache() private readonly cache: Cache,
        @InjectKeycloakAdmin() private readonly keycloak: KeycloakAdmin,
    ) {}

    /** The profile of the member, or the provider refusal. */
    async profile(params: MemberProfileParams): Promise<Outcome<MemberProfile, KeycloakAdminErrorCode>> {
        const request = { key: MEMBER_PROFILE_KEY, args: [params.memberId] }
        const cached = await this.cache.get(request)
        if (cached !== null) return ok(cached)
        const found = await this.keycloak.findMember(params.memberId)
        if (found.kind === "refused") return found
        const profile: MemberProfile = {
            memberId: found.value.id,
            email: found.value.email,
            displayName: found.value.displayName,
        }
        await this.cache.set({ ...request, value: profile })
        return ok(profile)
    }
}
