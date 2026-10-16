import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ToolStatusHttpOptions } from "./tool-status-http.options"

/** The configurable-module base of the tool-status-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ToolStatusHttpOptions>().setClassMethodName("register").build()
