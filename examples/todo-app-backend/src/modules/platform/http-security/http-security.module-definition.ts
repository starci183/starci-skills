import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HttpSecurityOptions } from "./http-security.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the http-security capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<HttpSecurityOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()

/** How the http-security module is composed: registered once at the app root and reached through injectors. */
export const HTTP_SECURITY_MODULE_KIND = ModuleKind.Capability
