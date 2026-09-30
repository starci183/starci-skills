import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"

/** The configurable-module base of the keycloak admin integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<KeycloakAdminOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
