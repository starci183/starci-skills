import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ExpireOrdersQueueOptions } from "./expire-orders-queue.options"

/** The configurable-module base of the expire-orders-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ExpireOrdersQueueOptions>().setClassMethodName("register").build()
