import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SystemHealthHttpOptions } from "./system-health-http.options"

/** The configurable-module base of the system-health-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SystemHealthHttpOptions>().setClassMethodName("register").build()
