import { ConfigurableModuleBuilder } from "@nestjs/common"
import { INVOICE_OPTIONS } from "./invoice.decorators"
import type { InvoiceOptions } from "./invoice.options"

/** The configurable-module base of the invoice capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InvoiceOptions>({ optionsInjectionToken: INVOICE_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
