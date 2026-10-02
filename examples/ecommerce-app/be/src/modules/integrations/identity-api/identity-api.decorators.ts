import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { IdentityApiOptions } from "./identity-api.options"

/** Token of the identity api client; it is also the health probe token and the session verifier token of the apps that call identity. */
export const IDENTITY_API: unique symbol = Symbol("integrations.identity-api")

/** Token of the options of the identity api integration, exported so a spec can provide it. */
export const IDENTITY_API_OPTIONS: unique symbol = Symbol("integrations.identity-api.options")

/** Injects the options of the identity api integration. Parameter type: IdentityApiOptions. */
export const InjectIdentityApiOptions = (): TypedParameterDecorator<IdentityApiOptions> =>
    injector<IdentityApiOptions>(IDENTITY_API_OPTIONS)
