import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ClockOptions } from "./clock.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the clock capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ClockOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the clock module is composed: registered once at the app root and reached through injectors. */
export const CLOCK_MODULE_KIND = ModuleKind.Capability
