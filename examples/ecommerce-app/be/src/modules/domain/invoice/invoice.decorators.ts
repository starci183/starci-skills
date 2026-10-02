import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { InvoiceService } from "./invoice.service"
import type { InvoiceOptions } from "./invoice.options"

/** Token of the invoice options, exported so a spec can provide it. */
export const INVOICE_OPTIONS: unique symbol = Symbol("domain.invoice.options")

/** Token of the InvoiceService of this capability, for the capabilities that use it. */
export const INVOICE_SERVICE: unique symbol = Symbol("domain.invoice.service")

/** Injects the InvoiceService. Parameter type: InvoiceService. */
export const InjectInvoiceService = (): TypedParameterDecorator<InvoiceService> =>
    injector<InvoiceService>(INVOICE_SERVICE)

/** Injects the options of the invoice capability. Parameter type: InvoiceOptions. */
export const InjectInvoiceOptions = (): TypedParameterDecorator<InvoiceOptions> =>
    injector<InvoiceOptions>(INVOICE_OPTIONS)
