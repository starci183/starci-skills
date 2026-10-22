import { ConfigurableModuleBuilder } from "@nestjs/common"
import { IDENTITY_API_OPTIONS } from "./identity-api.decorators"
import type { IdentityApiOptions } from "./identity-api.options"

/** The configurable-module base of the identity api integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<IdentityApiOptions>({ optionsInjectionToken: IDENTITY_API_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
