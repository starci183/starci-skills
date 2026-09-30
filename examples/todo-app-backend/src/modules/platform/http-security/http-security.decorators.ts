import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { HttpSecurityOptions } from "./http-security.options"

/** Token of the http-security options, exported so a spec can provide it. */
export const HTTP_SECURITY_OPTIONS: unique symbol = Symbol("platform.http-security.options")

/** Injects the options of the http-security capability. Parameter type: HttpSecurityOptions. */
export const InjectHttpSecurityOptions = (): TypedParameterDecorator<HttpSecurityOptions> =>
    injector<HttpSecurityOptions>(HTTP_SECURITY_OPTIONS)
