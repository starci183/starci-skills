import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderPaymentStatusOptions } from "./order-payment-status.options"

/** The configurable-module base of the order-payment-status module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OrderPaymentStatusOptions>().setClassMethodName("register").build()
