import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Reactor@@MessageOptions } from "./@@reactor@@-message.options"

/** The configurable-module base of the @@reactor@@-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Reactor@@MessageOptions>().setClassMethodName("register").build()
