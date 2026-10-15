import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SendReminderOptions } from "./send-reminder.options"

/** The configurable-module base of the send-reminder module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SendReminderOptions>().setClassMethodName("register").build()
