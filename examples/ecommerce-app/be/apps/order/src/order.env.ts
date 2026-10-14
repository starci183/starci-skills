import { parseIdentityApiConfig } from "@modules/integrations/identity-api"
import { parseReceiptStorageConfig } from "@modules/integrations/receipt-storage"
import type { EnvSource } from "@modules/platform/config"
import { parseOrderDatabaseConfig } from "@modules/platform/database"
import { parseEventBusConfig } from "@modules/platform/event-bus"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { parseJobsConfig } from "@modules/platform/jobs"
import { parseQueueConfig } from "@modules/platform/queue"
import { ORDER_PAYMENT_WINDOW_MS } from "@modules/queues/order-expiry"
import type { OrderAppOptions } from "./order.options"

/** The order environment values parsed before app composition. */
export interface OrderEnv extends OrderAppOptions {}

/** Reads the order environment; missing or invalid values fail boot and secret readers prefer mounted files. */
export const readOrderEnv = (env: EnvSource): OrderEnv => ({
    port: env.int("ORDER_API_PORT"),
    database: parseOrderDatabaseConfig(env),
    identityApi: parseIdentityApiConfig(env),
    eventBus: parseEventBusConfig(env),
    receiptStorage: parseReceiptStorageConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    queue: parseQueueConfig(env),
    jobs: parseJobsConfig(env),
    orderExpiry: {
        everyMs: env.duration("ORDER_EXPIRY_EVERY", 60_000),
        olderThanMs: env.duration("ORDER_PAYMENT_WINDOW", ORDER_PAYMENT_WINDOW_MS),
    },
})
