import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./identity-api.module-definition"
import type { IdentityApiOptions } from "./identity-api.options"

/** Token of the options of this capability, the token its configurable module provides them under. */
export const IDENTITY_API_OPTIONS: typeof MODULE_OPTIONS_TOKEN = MODULE_OPTIONS_TOKEN

/** Token of the identity api client; it is also the health probe token and the session verifier token of the apps that call identity. */
export const IDENTITY_API: unique symbol = Symbol("integrations.identity-api")

/** Injects the options of the identity api integration. Parameter type: IdentityApiOptions. */
export const InjectIdentityApiOptions = (): TypedParameterDecorator<IdentityApiOptions> =>
    injector<IdentityApiOptions>(IDENTITY_API_OPTIONS)
