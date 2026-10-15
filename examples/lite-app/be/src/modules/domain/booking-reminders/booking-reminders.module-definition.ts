import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingRemindersOptions } from "./booking-reminders.options"

/** The configurable-module base of the booking-reminders module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingRemindersOptions>().setClassMethodName("register").build()
