import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingsOptions } from "./bookings.options"

/** The configurable-module base of the bookings capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
