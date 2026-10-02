import { parseInvoiceConfig } from "@modules/domain/invoice"
import type { InvoiceOptions } from "@modules/domain/invoice"
import type { EnvSource } from "@modules/platform/config"
import { parseBillingDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import { parseEventBusConfig } from "@modules/platform/event-bus"
import type { EventBusConfig } from "@modules/platform/event-bus"

/** Everything the billing worker needs from its environment, parsed once in main.ts. */
export interface BillingAppOptions {
    /** The billing database connection. */
    readonly database: DatabaseConnectionConfig
    /** The broker the worker consumes order events from and announces invoices on. */
    readonly eventBus: EventBusConfig
    /** The billing limit. */
    readonly invoice: InvoiceOptions
}

/** Parses the billing worker options from the environment; a missing or malformed key stops the boot naming the key. */
export const parseBillingAppOptions = (env: EnvSource): BillingAppOptions => ({
    database: parseBillingDatabaseConfig(env),
    eventBus: parseEventBusConfig(env),
    invoice: parseInvoiceConfig(env),
})
