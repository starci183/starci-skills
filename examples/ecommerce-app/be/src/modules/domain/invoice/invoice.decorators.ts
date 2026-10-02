import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { InvoiceOptions } from "./invoice.options"

/** Token of the invoice options, exported so a spec can provide it. */
export const INVOICE_OPTIONS: unique symbol = Symbol("domain.invoice.options")

/** Injects the options of the invoice capability. Parameter type: InvoiceOptions. */
export const InjectInvoiceOptions = (): TypedParameterDecorator<InvoiceOptions> =>
    injector<InvoiceOptions>(INVOICE_OPTIONS)
