import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HealthOptions } from "./health.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the health capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<HealthOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the health module is composed: registered once at the app root and reached through injectors. */
export const HEALTH_MODULE_KIND = ModuleKind.Capability
