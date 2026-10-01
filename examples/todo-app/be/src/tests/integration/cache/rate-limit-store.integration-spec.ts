import { randomUUID } from "node:crypto"
import { CacheErrorCode } from "@modules/integrations/cache"
import { RATE_LIMIT_STORE } from "@modules/platform/http-security"
import type { RateLimitStore } from "@modules/platform/http-security"
import { CACHE_CAPABILITY_MODULES } from "@tests/world/test-capabilities.options"
import { useTestWorld } from "@tests/world/use-test-world"

const WINDOW_MS = 60_000
const SHORT_WINDOW_MS = 500

/**
 * cache: the rate limiter's shared counter in the run's own Redis DB, no HTTP door of ours. Every request of a key adds to
 * one count per window, kept in Redis where every replica of the api counts; the window ends with its key. A Redis that
 * cannot be reached is the declared cache-unavailable error (the limiter then counts in process, proven by its unit spec
 * and by the e2e outage of the api), and the store counts in Redis again, from where it stood, once Redis is back.
 */
describe("cache: rate-limit store (integration)", () => {
    const world = useTestWorld({ modules: CACHE_CAPABILITY_MODULES })

    const store = (): RateLimitStore => world.resolve<RateLimitStore>(RATE_LIMIT_STORE)
    const keyOf = (): string => `default:${randomUUID()}`

    it("counts every request of a key in one window, kept in the run's Redis", async () => {
        const key = keyOf()
        const keysBefore = await world.infra.redis.size()

        expect(await store().hit({ key, windowMs: WINDOW_MS })).toBe(1)
        expect(await store().hit({ key, windowMs: WINDOW_MS })).toBe(2)
        expect(await store().hit({ key: keyOf(), windowMs: WINDOW_MS })).toBe(1)

        expect(await world.infra.redis.size()).toBe(keysBefore + 2)
    })

    it("a window ends with its key, and the next request opens a new one", async () => {
        const key = keyOf()
        const keysBefore = await world.infra.redis.size()
        await store().hit({ key, windowMs: SHORT_WINDOW_MS })
        expect(await store().hit({ key, windowMs: SHORT_WINDOW_MS })).toBe(2)

        await world.waitUntil(
            "the window's key expired",
            () => world.infra.redis.size(),
            (size) => size === keysBefore,
        )

        expect(await store().hit({ key, windowMs: SHORT_WINDOW_MS })).toBe(1)
    })

    it("an unreachable Redis is the declared cache-unavailable error, and the count goes on in Redis once it is back", async () => {
        const key = keyOf()
        expect(await store().hit({ key, windowMs: WINDOW_MS })).toBe(1)

        await world.infra.redis.during(async () => {
            await expect(store().hit({ key, windowMs: WINDOW_MS })).rejects.toMatchObject({
                code: CacheErrorCode.Unavailable,
            })
        })

        // The client reconnects on its own; the first command after the outage may still meet the dropped connection.
        const counted = await world.waitFor("the store counts in Redis again", () =>
            store()
                .hit({ key, windowMs: WINDOW_MS })
                .then(
                    (count) => count,
                    () => null,
                ),
        )
        expect(counted).toBe(2)
    })
})
