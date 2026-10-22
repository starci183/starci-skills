import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderPaymentStatusMessageOptions } from "./order-payment-status-message.options"

/** The configurable-module base of the order-payment-status-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OrderPaymentStatusMessageOptions>().setClassMethodName("register").build()
