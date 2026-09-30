import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DatabaseOptions } from "./database.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the database capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DatabaseOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the database module is composed: registered once at the app root and reached through injectors. */
export const DATABASE_MODULE_KIND = ModuleKind.Capability
