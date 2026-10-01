import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./keycloak-admin.module-definition"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"
import type { KeycloakAdmin } from "./keycloak-admin.port"

/** Token of the keycloak admin port. */
export const KEYCLOAK_ADMIN: unique symbol = Symbol("integrations.keycloak-admin")

/** Injects the keycloak admin port. Parameter type: KeycloakAdmin. */
export const InjectKeycloakAdmin = (): TypedParameterDecorator<KeycloakAdmin> => injector<KeycloakAdmin>(KEYCLOAK_ADMIN)

/** Injects the options of the keycloak admin integration. Parameter type: KeycloakAdminOptions. */
export const InjectKeycloakAdminOptions = (): TypedParameterDecorator<KeycloakAdminOptions> =>
    injector<KeycloakAdminOptions>(MODULE_OPTIONS_TOKEN)
