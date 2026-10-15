import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingConfirmationOptions } from "./booking-confirmation.options"

/** The configurable-module base of the booking-confirmation module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingConfirmationOptions>().setClassMethodName("register").build()
