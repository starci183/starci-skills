import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ResourcesApiOptions } from "./resources.options"

/** The configurable-module base of the resources module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ResourcesApiOptions>().setClassMethodName("register").build()
