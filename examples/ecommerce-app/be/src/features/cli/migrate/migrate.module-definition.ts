import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MigrateOptions } from "./migrate.options"

/** The configurable-module base of the migrate group: the connections arrive from the cli app's options. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<MigrateOptions>().build()
