import { ConfigurableModuleBuilder } from "@nestjs/common"
import { ModuleKind } from "@modules/platform/composition"
import type { HttpSecurityOptions } from "./http-security.options"

/** The configurable-module base of the http-security capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<HttpSecurityOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()

/** How this module is composed: stateful, registered once per app at the root. */
export const HTTP_SECURITY_MODULE_KIND = ModuleKind.Capability
