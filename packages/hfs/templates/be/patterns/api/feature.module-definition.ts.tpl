import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Feature@@ApiOptions } from "./@@feature@@.options"

/** The configurable-module base of the @@feature@@ module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Feature@@ApiOptions>().setClassMethodName("register").build()
