import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Job@@Options } from "./@@job@@.options"

/** The configurable-module base of the @@job@@ module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Job@@Options>().setClassMethodName("register").build()
