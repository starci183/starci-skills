import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Group@@Options } from "./@@group@@.options"

/** The configurable-module base of the @@group@@ module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Group@@Options>().setClassMethodName("register").build()
