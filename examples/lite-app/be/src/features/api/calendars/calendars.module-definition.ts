import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CalendarsApiOptions } from "./calendars.options"

/** The configurable-module base of the calendars module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CalendarsApiOptions>().setClassMethodName("register").build()
