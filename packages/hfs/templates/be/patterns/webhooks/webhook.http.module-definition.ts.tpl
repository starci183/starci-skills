import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Provider@@HttpOptions } from "./@@provider@@-http.options"

/** The configurable-module base of the @@provider@@-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Provider@@HttpOptions>().setClassMethodName("register").build()
