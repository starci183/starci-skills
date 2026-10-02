import type { IdentityApiOptions } from "@modules/integrations/identity-api"
import { parseIdentityApiConfig } from "@modules/integrations/identity-api"
import type { ReceiptStorageOptions } from "@modules/integrations/receipt-storage"
import { parseReceiptStorageConfig } from "@modules/integrations/receipt-storage"
import type { EnvSource } from "@modules/platform/config"
import { parseOrderDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import { parseMessagingConfig } from "@modules/platform/messaging"
import type { MessagingOptions } from "@modules/platform/messaging"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import type { HttpSecurityOptions } from "@modules/platform/http-security"

/** Everything the order api needs from its environment, parsed once in main.ts. */
export interface OrderAppOptions {
    /** The port the api listens on. */
    readonly port: number
    /** The order database connection. */
    readonly database: DatabaseConnectionConfig
    /** Where the identity service answers. */
    readonly identityApi: IdentityApiOptions
    /** The Redis queues the order events are published on. */
    readonly messaging: MessagingOptions
    /** The private bucket the receipts of placed orders are archived in. */
    readonly receiptStorage: ReceiptStorageOptions
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: HttpSecurityOptions
}

/** Parses the order api options from the environment; a missing or malformed key stops the boot naming the key. */
export const parseOrderAppOptions = (env: EnvSource): OrderAppOptions => ({
    port: env.int("ORDER_API_PORT"),
    database: parseOrderDatabaseConfig(env),
    identityApi: parseIdentityApiConfig(env),
    messaging: parseMessagingConfig(env),
    receiptStorage: parseReceiptStorageConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
})
