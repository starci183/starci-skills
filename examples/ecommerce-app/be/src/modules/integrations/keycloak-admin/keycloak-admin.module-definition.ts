import { ConfigurableModuleBuilder } from "@nestjs/common"
import { KEYCLOAK_ADMIN_OPTIONS } from "./keycloak-admin.decorators"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"

/** The configurable-module base of the keycloak admin integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<KeycloakAdminOptions>({ optionsInjectionToken: KEYCLOAK_ADMIN_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
