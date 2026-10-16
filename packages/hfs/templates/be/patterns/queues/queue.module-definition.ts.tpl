import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Queue@@Options } from "./@@queue@@.options"

/** The configurable-module base of the @@queue@@ module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<@@Queue@@Options>().setClassMethodName("register").build()
