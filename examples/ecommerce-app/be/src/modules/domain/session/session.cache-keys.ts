import { defineCacheKey } from "@modules/integrations/cache"
import { isRecord } from "@modules/platform/primitives"
import type { StoredSession } from "./session.contracts"

/** A live session: the person and the identity provider's refresh token, kept an hour. */
export const SESSION_KEY = defineCacheKey<StoredSession>({
    name: "identity.session",
    ttl: { seconds: 3600 },
    store: "redis",
    parse: (stored) =>
        isRecord(stored) && typeof stored.personId === "string" && typeof stored.providerRefreshToken === "string"
            ? { personId: stored.personId, providerRefreshToken: stored.providerRefreshToken }
            : null,
})
