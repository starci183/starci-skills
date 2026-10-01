import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { HttpSecurityOptions } from "./http-security.options"
import type { RateLimitStore } from "./rate-limit-store.port"

/** Token of the http-security options, exported so a spec can provide it. */
export const HTTP_SECURITY_OPTIONS: unique symbol = Symbol("platform.http-security.options")

/** Injects the options of the http-security capability. Parameter type: HttpSecurityOptions. */
export const InjectHttpSecurityOptions = (): TypedParameterDecorator<HttpSecurityOptions> =>
    injector<HttpSecurityOptions>(HTTP_SECURITY_OPTIONS)

/** Token of the shared rate-limit store; an integration provides it (the Redis of the stack). */
export const RATE_LIMIT_STORE: unique symbol = Symbol("platform.http-security.rate-limit-store")

/** Injects the shared rate-limit store. Parameter type: RateLimitStore. */
export const InjectRateLimitStore = (): TypedParameterDecorator<RateLimitStore> =>
    injector<RateLimitStore>(RATE_LIMIT_STORE)
