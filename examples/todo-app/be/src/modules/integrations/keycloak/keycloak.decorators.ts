import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { KeycloakClient } from "./keycloak.client"
import type { KeycloakOptions } from "./keycloak.options"

/** Token of the keycloak client. */
export const KEYCLOAK: unique symbol = Symbol("integrations.keycloak")

/** Injects the keycloak client, the only caller of the identity provider. Parameter type: KeycloakClient. */
export const InjectKeycloak = (): TypedParameterDecorator<KeycloakClient> => injector<KeycloakClient>(KEYCLOAK)

/** Token of the keycloak options, exported so a spec can provide it. */
export const KEYCLOAK_OPTIONS: unique symbol = Symbol("integrations.keycloak.options")

/** Injects the options of the keycloak integration. Parameter type: KeycloakOptions. */
export const InjectKeycloakOptions = (): TypedParameterDecorator<KeycloakOptions> =>
    injector<KeycloakOptions>(KEYCLOAK_OPTIONS)
