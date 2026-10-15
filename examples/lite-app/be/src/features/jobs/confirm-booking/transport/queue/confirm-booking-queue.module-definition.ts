import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfirmBookingQueueOptions } from "./confirm-booking-queue.options"

/** The configurable-module base of the confirm-booking-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ConfirmBookingQueueOptions>().setClassMethodName("register").build()
