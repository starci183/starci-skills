import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Saga@@MessageOptions } from "./@@saga@@-message.options"

/** The configurable-module base of the @@saga@@-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Saga@@MessageOptions>().setClassMethodName("register").build()
