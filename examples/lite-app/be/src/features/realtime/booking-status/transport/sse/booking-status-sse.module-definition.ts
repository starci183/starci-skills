import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingStatusSseOptions } from "./booking-status-sse.options"

/** The configurable-module base of the booking-status-sse module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BookingStatusSseOptions>().setClassMethodName("register").build()
