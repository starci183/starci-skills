import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CheckoutGraphqlOptions } from "./checkout-graphql.options"

/** The configurable-module base of the checkout-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CheckoutGraphqlOptions>().setClassMethodName("register").build()
