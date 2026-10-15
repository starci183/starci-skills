import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Reactor@@Options } from "./@@reactor@@.options"

/** The configurable-module base of the @@reactor@@ module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Reactor@@Options>().setClassMethodName("register").build()
