import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingsApiOptions } from "./bookings.options"

/** The configurable-module base of the bookings module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BookingsApiOptions>().setClassMethodName("register").build()
