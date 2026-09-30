import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CqrsOptions } from "./cqrs.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the cqrs capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CqrsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the cqrs module is composed: registered once at the app root and reached through injectors. */
export const CQRS_MODULE_KIND = ModuleKind.Capability
