import { parseReceiptStorageConfig } from "@modules/integrations/receipt-storage"
import type { ReceiptStorageOptions } from "@modules/integrations/receipt-storage"
import type { EnvSource } from "@modules/platform/config"
import { parseOrderDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import { parseMessagingConfig } from "@modules/integrations/messaging"
import type { MessagingOptions } from "@modules/integrations/messaging"

/** Everything the order worker needs from its environment, parsed once in main.ts. */
export interface OrderWorkerAppOptions {
    /** The order database connection, the one the order api writes. */
    readonly database: DatabaseConnectionConfig
    /** The Redis queues the worker consumes the billing events from. */
    readonly messaging: MessagingOptions
    /** The private bucket of the receipts; the order capability the worker shares with the api composes it. */
    readonly receiptStorage: ReceiptStorageOptions
}

/** Parses the order worker options from the environment; a missing or malformed key stops the boot naming the key. */
export const parseOrderWorkerAppOptions = (env: EnvSource): OrderWorkerAppOptions => ({
    database: parseOrderDatabaseConfig(env),
    messaging: parseMessagingConfig(env),
    receiptStorage: parseReceiptStorageConfig(env),
})
