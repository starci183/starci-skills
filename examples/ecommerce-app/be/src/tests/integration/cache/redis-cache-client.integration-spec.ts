import { randomUUID } from "node:crypto"
import { CACHE, CacheErrorCode, defineCacheKey } from "@modules/integrations/cache"
import type { Cache } from "@modules/integrations/cache"
import { CACHE_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/** A probe key of this spec: a person id cached for a minute. */
const PROBE_KEY = defineCacheKey<string>({
    name: "integration.cache-probe",
    ttl: { seconds: 60 },
    store: "redis",
    parse: (stored) => (typeof stored === "string" ? stored : null),
})

/** The same entry read as a number: the key's own parser rejects a value of another shape. */
const NUMBER_KEY = defineCacheKey<number>({
    name: "integration.cache-probe",
    ttl: { seconds: 60 },
    store: "redis",
    parse: (stored) => (typeof stored === "number" ? stored : null),
})

/**
 * cache: the real Redis client against the run's own Redis DB, no HTTP door of ours. A value set under a key reads back,
 * lives in the repository's Redis, and is gone once deleted; a stored value of another shape reads as absent through the
 * key's parser. A Redis that cannot be reached is the declared cache-unavailable refusal, and the client serves again once
 * Redis is back.
 */
describe("cache: redis client (integration)", () => {
    const world = useTestWorld({ modules: CACHE_CAPABILITY_MODULES })

    const cache = (): Cache => world.resolve<Cache>(CACHE)

    it("sets a value, reads it back from the run's Redis, and deletes it", async () => {
        const id = randomUUID()
        const keysBefore = await world.infra.redis.size()

        await cache().set({ key: PROBE_KEY, args: [id], value: `person-${id}` })
        expect(await cache().get({ key: PROBE_KEY, args: [id] })).toBe(`person-${id}`)
        expect(await world.infra.redis.size()).toBe(keysBefore + 1)

        await cache().del({ key: PROBE_KEY, args: [id] })
        expect(await cache().get({ key: PROBE_KEY, args: [id] })).toBeNull()
    })

    it("a stored value of another shape reads as absent through the key's parser", async () => {
        const id = randomUUID()
        await cache().set({ key: PROBE_KEY, args: [id], value: "not a number" })

        expect(await cache().get({ key: NUMBER_KEY, args: [id] })).toBeNull()
    })

    it("an unreachable Redis is the declared cache-unavailable refusal, and the client serves again once Redis is back", async () => {
        const id = randomUUID()

        await world.infra.redis.during(async () => {
            await expect(cache().get({ key: PROBE_KEY, args: [id] })).rejects.toMatchObject({
                code: CacheErrorCode.Unavailable,
            })
        })

        // The client reconnects on its own; the first command after the outage may still meet the dropped connection.
        await world.waitFor("the cache answers again", () =>
            cache()
                .set({ key: PROBE_KEY, args: [id], value: "back" })
                .then(
                    () => true,
                    () => null,
                ),
        )
        expect(await cache().get({ key: PROBE_KEY, args: [id] })).toBe("back")
    })
})
