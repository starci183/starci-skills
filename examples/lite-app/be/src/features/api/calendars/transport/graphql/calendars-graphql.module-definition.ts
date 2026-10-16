import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CalendarsGraphqlOptions } from "./calendars-graphql.options"

/** The configurable-module base of the calendars-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CalendarsGraphqlOptions>().setClassMethodName("register").build()
