import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ToolStatusOptions } from "./tool-status.options"

/** The configurable-module base of the tool-status module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ToolStatusOptions>().setClassMethodName("register").build()
