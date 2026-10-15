import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SendReceiptQueueOptions } from "./send-receipt-queue.options"

/** The configurable-module base of the send-receipt-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SendReceiptQueueOptions>().setClassMethodName("register").build()
