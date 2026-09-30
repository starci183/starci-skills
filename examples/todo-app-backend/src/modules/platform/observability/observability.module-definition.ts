import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ObservabilityOptions } from "./observability.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the observability capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ObservabilityOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the observability module is composed: registered once at the app root and reached through injectors. */
export const OBSERVABILITY_MODULE_KIND = ModuleKind.Capability
