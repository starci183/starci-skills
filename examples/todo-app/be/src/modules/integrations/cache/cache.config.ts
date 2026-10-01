import type { EnvSource } from "@modules/platform/config"
import type { CacheOptions } from "./cache.options"

/** Reads the cache options from `CACHE_REDIS_URL`. */
export const parseCacheConfig = (env: EnvSource): CacheOptions => ({ url: env.secret("CACHE_REDIS_URL") })
