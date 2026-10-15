import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Saga@@Options } from "./@@saga@@.options"

/** The configurable-module base of the @@saga@@ module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Saga@@Options>().setClassMethodName("register").build()
