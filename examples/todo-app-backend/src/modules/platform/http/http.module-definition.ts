import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HttpOptions } from "./http.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the http capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<HttpOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the http module is composed: registered once at the app root and reached through injectors. */
export const HTTP_MODULE_KIND = ModuleKind.Capability
