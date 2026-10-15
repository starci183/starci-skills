import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InvoicingMessageOptions } from "./invoicing-message.options"

/** The configurable-module base of the invoicing-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<InvoicingMessageOptions>().setClassMethodName("register").build()
