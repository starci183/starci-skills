import { defineCacheKey } from "@modules/integrations/cache"

/** The live session of one bearer token: the value is the person id, the store forgets it after an hour. */
export const SESSION_KEY = defineCacheKey<string>({
    name: "identity.session",
    ttl: { seconds: 3600 },
    store: "redis",
    parse: (stored) => (typeof stored === "string" ? stored : null),
})
