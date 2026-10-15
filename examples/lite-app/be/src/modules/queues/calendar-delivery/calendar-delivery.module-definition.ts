import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CalendarDeliveryOptions } from "./calendar-delivery.options"

/** The configurable-module base of the calendar-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CalendarDeliveryOptions>().setClassMethodName("register").build()
