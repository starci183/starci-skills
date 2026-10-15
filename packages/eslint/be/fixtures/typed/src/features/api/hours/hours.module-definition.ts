import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HoursOptions } from "./hours.options"

/** The configurable-module base of the hours feature (fixture). */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<HoursOptions>().setClassMethodName("register").build()
