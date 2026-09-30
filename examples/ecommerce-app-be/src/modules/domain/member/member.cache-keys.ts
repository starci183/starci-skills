import { defineCacheKey } from "@modules/integrations/cache"
import { isRecord } from "@modules/platform/primitives"
import type { MemberProfile } from "./member.contracts"

/** The profile of one member: the value is the shop view of the member, kept five minutes so the identity provider is not asked on every request. */
export const MEMBER_PROFILE_KEY = defineCacheKey<MemberProfile>({
    name: "member.profile",
    ttl: { seconds: 300 },
    store: "redis",
    parse: (stored) =>
        isRecord(stored) &&
        typeof stored.memberId === "string" &&
        typeof stored.email === "string" &&
        typeof stored.displayName === "string"
            ? { memberId: stored.memberId, email: stored.email, displayName: stored.displayName }
            : null,
})
