import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HoursHttpOptions } from "./hours-http.options"

/** The configurable-module base of the hours HTTP transport (fixture). */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<HoursHttpOptions>().setClassMethodName("register").build()
