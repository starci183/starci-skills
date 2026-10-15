import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderStatusGraphqlOptions } from "./order-status-graphql.options"

/** The configurable-module base of the order-status-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrderStatusGraphqlOptions>().setClassMethodName("register").build()
