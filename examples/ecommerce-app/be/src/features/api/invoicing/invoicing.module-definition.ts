import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InvoicingOptions } from "./invoicing.options"

/** The configurable-module base of the invoicing module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InvoicingOptions>().setClassMethodName("register").build()
