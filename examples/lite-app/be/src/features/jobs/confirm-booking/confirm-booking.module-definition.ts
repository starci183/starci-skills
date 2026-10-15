import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfirmBookingOptions } from "./confirm-booking.options"

/** The configurable-module base of the confirm-booking module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ConfirmBookingOptions>().setClassMethodName("register").build()
