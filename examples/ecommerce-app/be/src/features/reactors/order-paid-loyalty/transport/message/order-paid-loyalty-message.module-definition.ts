import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderPaidLoyaltyMessageOptions } from "./order-paid-loyalty-message.options"

/** The configurable-module base of the order-paid-loyalty-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OrderPaidLoyaltyMessageOptions>().setClassMethodName("register").build()
