import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CheckoutHttpOptions } from "./checkout-http.options"

/** The configurable-module base of the checkout-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CheckoutHttpOptions>().setClassMethodName("register").build()
