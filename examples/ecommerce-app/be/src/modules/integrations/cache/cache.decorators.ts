import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Cache, RedisFactory } from "./cache.port"
import { MODULE_OPTIONS_TOKEN } from "./cache.module-definition"
import type { CacheOptions } from "./cache.options"

/** Token of the Cache port; it is also the health probe token of the cache. */
export const CACHE: unique symbol = Symbol("integrations.cache")

/** Token of the factory that builds the Redis driver, exported so a spec can provide it. */
export const REDIS_FACTORY: unique symbol = Symbol("integrations.cache.redis-factory")

/** Injects the options of the cache integration. Parameter type: CacheOptions. */
export const InjectCacheOptions = (): TypedParameterDecorator<CacheOptions> =>
    injector<CacheOptions>(MODULE_OPTIONS_TOKEN)

/** Injects the Cache port. Parameter type: Cache. */
export const InjectCache = (): TypedParameterDecorator<Cache> => injector<Cache>(CACHE)

/** Injects the factory that builds the Redis driver. Parameter type: RedisFactory. */
export const InjectRedisFactory = (): TypedParameterDecorator<RedisFactory> => injector<RedisFactory>(REDIS_FACTORY)
