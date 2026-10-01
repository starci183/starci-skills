import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { CacheOptions } from "./cache.options"

/** Token of the options of the cache integration. */
export const CACHE_OPTIONS: unique symbol = Symbol("integrations.cache.options")

/** Injects the options of the cache integration. Parameter type: CacheOptions. */
export const InjectCacheOptions = (): TypedParameterDecorator<CacheOptions> => injector<CacheOptions>(CACHE_OPTIONS)
