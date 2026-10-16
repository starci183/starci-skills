import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CalendarHttpOptions } from "./calendar-http.options"

/** The configurable-module base of the calendar-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CalendarHttpOptions>().setClassMethodName("register").build()
