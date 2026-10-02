import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MigrateOptions } from "./migrate/migrate.options"

/** The configurable-module base of the cli feature root: what its groups need, from the cli app's options. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<MigrateOptions>().build()
