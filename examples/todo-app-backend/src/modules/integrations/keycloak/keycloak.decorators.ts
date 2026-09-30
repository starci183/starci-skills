import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { KeycloakClient } from "./keycloak.client"
import { MODULE_OPTIONS_TOKEN } from "./keycloak.module-definition"
import type { KeycloakOptions } from "./keycloak.options"

/** Token of the keycloak client. */
export const KEYCLOAK: unique symbol = Symbol("integrations.keycloak")

/** Injects the keycloak client, the only caller of the identity provider. Parameter type: KeycloakClient. */
export const InjectKeycloak = (): TypedParameterDecorator<KeycloakClient> => injector<KeycloakClient>(KEYCLOAK)

/** Injects the options of the keycloak integration. Parameter type: KeycloakOptions. */
export const InjectKeycloakOptions = (): TypedParameterDecorator<KeycloakOptions> =>
    injector<KeycloakOptions>(MODULE_OPTIONS_TOKEN)
