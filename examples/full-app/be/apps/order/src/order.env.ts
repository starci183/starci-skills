import { parseOrderConfig } from "@modules/domain/order"
import { parseIdentityApiConfig } from "@modules/integrations/identity-api"
import { parseReceiptStorageConfig } from "@modules/integrations/receipt-storage"
import type { EnvSource } from "@modules/platform/config"
import { parseOrderDatabaseConfig } from "@modules/platform/database"
import { parseEventBusConfig } from "@modules/platform/event-bus"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { parseJobsConfig } from "@modules/platform/jobs"
import { parseQueueConfig } from "@modules/platform/queue"
import { ORDER_PAYMENT_WINDOW_MS } from "@modules/queues/order-expiry"
import type { OrderExpiryOptions } from "@modules/queues/order-expiry"

/** The order environment values parsed before app composition. */
export interface OrderEnv {
    /** The port the API listens on. */
    readonly port: number
    /** The order database connection. */
    readonly database: ReturnType<typeof parseOrderDatabaseConfig>
    /** Where the identity service answers. */
    readonly identityApi: ReturnType<typeof parseIdentityApiConfig>
    /** The broker for publishing order events and consuming billing events. */
    readonly eventBus: ReturnType<typeof parseEventBusConfig>
    /** The private bucket that archives order receipts. */
    readonly receiptStorage: ReturnType<typeof parseReceiptStorageConfig>
    /** The key the cursors of the order list are signed with. */
    readonly order: ReturnType<typeof parseOrderConfig>
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: ReturnType<typeof parseHttpSecurityConfig>
    /** How the queue relay and workers run. */
    readonly queue: ReturnType<typeof parseQueueConfig>
    /** Who this worker is and how long a job claim lasts. */
    readonly jobs: ReturnType<typeof parseJobsConfig>
    /** How often the expiry sweep runs and how long an order waits for payment. */
    readonly orderExpiry: OrderExpiryOptions
}

/** Reads the order environment; missing or invalid values fail boot and secret readers prefer mounted files. */
export const readOrderEnv = (env: EnvSource): OrderEnv => ({
    port: env.int("ORDER_API_PORT"),
    database: parseOrderDatabaseConfig(env),
    identityApi: parseIdentityApiConfig(env),
    eventBus: parseEventBusConfig(env),
    receiptStorage: parseReceiptStorageConfig(env),
    order: parseOrderConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    queue: parseQueueConfig(env),
    jobs: parseJobsConfig(env),
    orderExpiry: {
        everyMs: env.duration("ORDER_EXPIRY_EVERY", 60_000),
        olderThanMs: env.duration("ORDER_PAYMENT_WINDOW", ORDER_PAYMENT_WINDOW_MS),
    },
})
