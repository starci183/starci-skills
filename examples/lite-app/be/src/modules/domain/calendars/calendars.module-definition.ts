import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CalendarsOptions } from "./calendars.options"

/** The configurable-module base of the calendars capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CalendarsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
