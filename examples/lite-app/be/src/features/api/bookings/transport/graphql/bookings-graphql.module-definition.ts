import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingsGraphqlOptions } from "./bookings-graphql.options"

/** The configurable-module base of the bookings-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingsGraphqlOptions>().setClassMethodName("register").build()
