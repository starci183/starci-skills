import type { EnvSource } from "@modules/platform/config"
import type { InvoiceOptions } from "./invoice.options"

/** Reads the invoice options: the billing limit is a tunable with a literal default. */
export const parseInvoiceConfig = (env: EnvSource): InvoiceOptions => ({
    maxTotalMinorUnits: env.int("INVOICE_MAX_TOTAL_MINOR_UNITS", 50_000_000),
})
