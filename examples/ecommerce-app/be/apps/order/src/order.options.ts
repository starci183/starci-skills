import type { IdentityApiOptions } from "@modules/integrations/identity-api"
import { parseIdentityApiConfig } from "@modules/integrations/identity-api"
import type { ReceiptStorageOptions } from "@modules/integrations/receipt-storage"
import { parseReceiptStorageConfig } from "@modules/integrations/receipt-storage"
import type { EnvSource } from "@modules/platform/config"
import { ORDER_PAYMENT_WINDOW_MS } from "@modules/queues/order-expiry"
import type { OrderExpiryOptions } from "@modules/queues/order-expiry"
import { parseOrderDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import { parseEventBusConfig } from "@modules/platform/event-bus"
import type { EventBusConfig } from "@modules/platform/event-bus"
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
    /** The broker the order events are published on and the billing events are read from. */
    readonly eventBus: EventBusConfig
    /** The private bucket the receipts of placed orders are archived in. */
    readonly receiptStorage: ReceiptStorageOptions
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: HttpSecurityOptions
    /** How often the expiry sweep runs and how long an order waits for its payment. */
    readonly orderExpiry: OrderExpiryOptions
}

/** Parses the order api options from the environment; a missing or malformed key stops the boot naming the key. */
export const parseOrderAppOptions = (env: EnvSource): OrderAppOptions => ({
    port: env.int("ORDER_API_PORT"),
    database: parseOrderDatabaseConfig(env),
    identityApi: parseIdentityApiConfig(env),
    eventBus: parseEventBusConfig(env),
    receiptStorage: parseReceiptStorageConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    orderExpiry: {
        everyMs: env.duration("ORDER_EXPIRY_EVERY", 60_000),
        olderThanMs: env.duration("ORDER_PAYMENT_WINDOW", ORDER_PAYMENT_WINDOW_MS),
    },
})
