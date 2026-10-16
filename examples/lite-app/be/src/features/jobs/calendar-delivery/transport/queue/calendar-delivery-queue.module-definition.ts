import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CalendarDeliveryQueueOptions } from "./calendar-delivery-queue.options"

/** The configurable-module base of the calendar-delivery-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CalendarDeliveryQueueOptions>().setClassMethodName("register").build()
