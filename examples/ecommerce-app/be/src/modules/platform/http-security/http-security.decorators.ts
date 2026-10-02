import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./http-security.module-definition"
import type { HttpSecurityOptions } from "./http-security.options"

/** Token of the options of the http-security capability. */
export const HTTP_SECURITY_OPTIONS: typeof MODULE_OPTIONS_TOKEN = MODULE_OPTIONS_TOKEN

/** Injects the options of the http-security capability. Parameter type: HttpSecurityOptions. */
export const InjectHttpSecurityOptions = (): TypedParameterDecorator<HttpSecurityOptions> =>
    injector<HttpSecurityOptions>(HTTP_SECURITY_OPTIONS)
