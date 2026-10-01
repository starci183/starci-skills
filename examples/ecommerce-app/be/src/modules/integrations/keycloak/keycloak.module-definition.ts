import { ConfigurableModuleBuilder } from "@nestjs/common"
import { KEYCLOAK_OPTIONS } from "./keycloak.decorators"
import type { KeycloakOptions } from "./keycloak.options"

/** The configurable-module base of the keycloak integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<KeycloakOptions>({ optionsInjectionToken: KEYCLOAK_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
