import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Cache } from "./cache.port"
import { MODULE_OPTIONS_TOKEN } from "./cache.module-definition"
import type { CacheOptions } from "./cache.options"

/** Token of the Cache port; it is also the health probe token of the cache. */
export const CACHE: unique symbol = Symbol("integrations.cache")

/** Injects the options of the cache integration. Parameter type: CacheOptions. */
export const InjectCacheOptions = (): TypedParameterDecorator<CacheOptions> =>
    injector<CacheOptions>(MODULE_OPTIONS_TOKEN)

/** Injects the Cache port. Parameter type: Cache. */
export const InjectCache = (): TypedParameterDecorator<Cache> => injector<Cache>(CACHE)
