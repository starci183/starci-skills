import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SendReminderQueueOptions } from "./send-reminder-queue.options"

/** The configurable-module base of the send-reminder-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SendReminderQueueOptions>().setClassMethodName("register").build()
