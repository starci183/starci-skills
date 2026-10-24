import type { OrderOptions } from "@modules/domain/order"
import type { IdentityApiOptions } from "@modules/integrations/identity-api"
import type { ReceiptStorageOptions } from "@modules/integrations/receipt-storage"
import type { OrderExpiryOptions } from "@modules/queues/order-expiry"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import type { EventBusConfig } from "@modules/platform/event-bus"
import type { HttpSecurityOptions } from "@modules/platform/http-security"
import type { JobsConfig } from "@modules/platform/jobs"
import type { QueueConfig } from "@modules/platform/queue"

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
    /** The key the cursors of the order list are signed with. */
    readonly order: OrderOptions
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: HttpSecurityOptions
    /** How often the expiry sweep runs and how long an order waits for its payment. */
    readonly orderExpiry: OrderExpiryOptions
    /** Where Redis is and how the queue relay and workers run. */
    readonly queue: QueueConfig
    /** Who this worker is and how long a job claim lasts. */
    readonly jobs: JobsConfig
}
