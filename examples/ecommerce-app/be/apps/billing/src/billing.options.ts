import { parseInvoiceConfig } from "@modules/domain/invoice"
import type { InvoiceOptions } from "@modules/domain/invoice"
import type { EnvSource } from "@modules/platform/config"
import { parseBillingDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import { parseMessagingConfig } from "@modules/integrations/messaging"
import type { MessagingOptions } from "@modules/integrations/messaging"

/** Everything the billing worker needs from its environment, parsed once in main.ts. */
export interface BillingAppOptions {
    /** The billing database connection. */
    readonly database: DatabaseConnectionConfig
    /** The Redis queues the worker consumes order events from and announces rejections on. */
    readonly messaging: MessagingOptions
    /** The billing limit. */
    readonly invoice: InvoiceOptions
}

/** Parses the billing worker options from the environment; a missing or malformed key stops the boot naming the key. */
export const parseBillingAppOptions = (env: EnvSource): BillingAppOptions => ({
    database: parseBillingDatabaseConfig(env),
    messaging: parseMessagingConfig(env),
    invoice: parseInvoiceConfig(env),
})
