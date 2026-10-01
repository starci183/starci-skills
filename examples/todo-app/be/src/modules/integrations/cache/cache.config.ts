import type { EnvSource } from "@modules/platform/config"
import type { CacheOptions } from "./cache.options"

/** Reads the cache options: `CACHE_REDIS_URL` is required, the command deadline is a tunable with a literal default. */
export const parseCacheConfig = (env: EnvSource): CacheOptions => ({
    url: env.secret("CACHE_REDIS_URL"),
    timeoutMs: env.duration("CACHE_TIMEOUT", 2000),
})
