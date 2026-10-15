import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingReminderOptions } from "./booking-reminder.options"

/** The configurable-module base of the booking-reminder module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingReminderOptions>().setClassMethodName("register").build()
