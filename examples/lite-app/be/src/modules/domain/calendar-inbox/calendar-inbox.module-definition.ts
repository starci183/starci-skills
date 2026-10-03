import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CalendarInboxOptions } from "./calendar-inbox.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CalendarInboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
