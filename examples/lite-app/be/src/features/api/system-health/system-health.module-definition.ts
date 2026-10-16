import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SystemHealthOptions } from "./system-health.options"

/** The configurable-module base of the system-health module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SystemHealthOptions>().setClassMethodName("register").build()
