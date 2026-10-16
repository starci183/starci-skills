import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CalendarDeliveryJobOptions } from "./calendar-delivery.options"

/** The configurable-module base of the calendar-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CalendarDeliveryJobOptions>().setClassMethodName("register").build()
