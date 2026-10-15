import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HealthHttpOptions } from "./health-http.options"

/** The configurable-module base of the health-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<HealthHttpOptions>().setClassMethodName("register").build()
