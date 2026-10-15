import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HealthOptions } from "./health.options"

/** The configurable-module base of the health module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<HealthOptions>().setClassMethodName("register").build()
