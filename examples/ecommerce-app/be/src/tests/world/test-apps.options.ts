/**
 * The typed options the test world hands to the real apps, and the platform base of a modules world: what the `main.ts` of
 * each app would parse from the environment of a deployment, built as objects from the wiring of the run. Both databases and
 * the Redis of the cache and Keycloak with the stack's realm are the real ones the library runs; each app is wired to the
 * other through the URL the library reserved for it before either booted.
 */
import type { DynamicModule } from "@nestjs/common"
import type { WorldWiring } from "@starci/test-world"
import { accountEntities } from "@modules/domain/account"
import { cartEntities } from "@modules/domain/cart"
import { catalogEntities } from "@modules/domain/catalog"
import { invoiceEntities } from "@modules/domain/invoice"
import { loyaltyEntities } from "@modules/domain/loyalty"
import { orderEntities } from "@modules/domain/order"
import { paymentEntities } from "@modules/domain/payment"
import { ClockModule } from "@modules/platform/clock"
import type { HttpSecurityOptions } from "@modules/platform/http-security"
import { EnvSource, Secret } from "@modules/platform/config"
import {
    DatabaseModule,
    parseBillingDatabaseConfig,
    parseIdentityDatabaseConfig,
    parseOrderDatabaseConfig,
} from "@modules/platform/database"
import type { DatabaseConnectionConfig, DatabaseConnectionOptions } from "@modules/platform/database"
import { HttpModule } from "@modules/platform/http"
import { inboxEntities } from "@modules/platform/inbox"
import { eventBusEntities } from "@modules/platform/event-bus"
import { jobsEntities } from "@modules/platform/jobs"
import { queueEntities } from "@modules/platform/queue"
import type { EventBusConfig } from "@modules/platform/event-bus"
import type { QueueConfig } from "@modules/platform/queue"
import { sagaEntities } from "@modules/platform/saga"
import { orderSummaryEntities } from "@modules/projections/order-summary"
import { LoggingModule } from "@modules/platform/logging"
import type { CacheOptions } from "@modules/integrations/cache"
import type { IdentityApiOptions } from "@modules/integrations/identity-api"
import type { KeycloakOptions } from "@modules/integrations/keycloak"
import type { KeycloakAdminOptions } from "@modules/integrations/keycloak-admin"
import type { OrderApiOptions } from "@modules/integrations/order-api"
import type { ReceiptStorageOptions } from "@modules/integrations/receipt-storage"
import type { BillingAppOptions } from "../../../apps/billing/src/billing.options"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import type { IdentityAppOptions } from "../../../apps/identity/src/identity.options"
import type { OrderAppOptions } from "../../../apps/order/src/order.options"

const RATE_LIMIT_HIGH = 100_000

/** The expiry sweep of the world ticks twice a second; the payment window is the deployment default, so only an order a spec backdates expires. */
const ORDER_EXPIRY_TICK_MS = 500
const ORDER_PAYMENT_WINDOW_TEST_MS = 3_600_000
const CALL_DEADLINE_MS = 5000
const ALLOWED_ORIGINS: ReadonlyArray<string> = ["http://localhost:4069"]

/** The public client of the realm shoppers sign in through with the password grant (realm-ecommerce.json). */
export const KEYCLOAK_SIGN_IN_CLIENT = "identity-api"

/** The confidential client of the realm whose service account creates the shoppers (realm-ecommerce.json). */
export const KEYCLOAK_ADMIN_CLIENT = "identity-admin"

/** The wiring of the ecommerce world: its three apps, their three connections and the bank transfer notifier fake. */
export type EcommerceWiring = WorldWiring<"identity" | "order" | "billing", "identity" | "order" | "billing", "sepay">

/** The entities the identity connection maps. */
export const IDENTITY_ENTITIES: DatabaseConnectionOptions["entities"] = accountEntities

/** The entities the order connection maps. */
export const ORDER_ENTITIES: DatabaseConnectionOptions["entities"] = [
    ...catalogEntities,
    ...cartEntities,
    ...orderEntities,
    ...loyaltyEntities,
    ...orderSummaryEntities,
    ...inboxEntities,
    ...sagaEntities,
    ...eventBusEntities,
    ...queueEntities,
    ...jobsEntities,
]

/** The entities the billing connection maps. */
export const BILLING_ENTITIES: DatabaseConnectionOptions["entities"] = [...invoiceEntities, ...paymentEntities, ...inboxEntities, ...eventBusEntities]

/** The identity connection of the run, read the way the identity app's `main.ts` reads its environment. */
const identityDatabase = (w: EcommerceWiring): DatabaseConnectionConfig =>
    parseIdentityDatabaseConfig(new EnvSource({ IDENTITY_DB_URL: w.db.identity.url }))

/** The order connection of the run, read the way the order app's `main.ts` reads its environment. */
const orderDatabase = (w: EcommerceWiring): DatabaseConnectionConfig =>
    parseOrderDatabaseConfig(new EnvSource({ ORDER_DB_URL: w.db.order.url }))

/** The billing connection of the run, read the way the billing worker's `main.ts` reads its environment. */
const billingDatabase = (w: EcommerceWiring): DatabaseConnectionConfig =>
    parseBillingDatabaseConfig(new EnvSource({ BILLING_DB_URL: w.db.billing.url }))

/** The Redis of the run, the store of the identity app's cache. */
export const cacheOptionsOf = (w: EcommerceWiring): CacheOptions => ({
    url: new Secret(w.redis.url),
    timeoutMs: CALL_DEADLINE_MS,
})

/** The realm of the run, as shoppers sign in to it. */
export const keycloakOptionsOf = (w: EcommerceWiring): KeycloakOptions => ({
    tokenUrl: w.keycloak.tokenUrl,
    clientId: w.keycloak.clientId,
    timeoutMs: CALL_DEADLINE_MS,
})

/** The realm of the run, written through the service account of the confidential admin client. */
export const keycloakAdminOptionsOf = (w: EcommerceWiring): KeycloakAdminOptions => ({
    url: w.keycloak.baseUrl,
    realm: w.keycloak.realm,
    clientId: KEYCLOAK_ADMIN_CLIENT,
    clientSecret: new Secret(w.keycloak.clientSecret(KEYCLOAK_ADMIN_CLIENT)),
    timeoutMs: CALL_DEADLINE_MS,
})

/** The order app of the run, as the identity app calls it. */
export const orderApiOptionsOf = (w: EcommerceWiring): OrderApiOptions => ({
    url: w.apps.order.url,
    timeoutMs: CALL_DEADLINE_MS,
})

/** The identity app of the run, as the order app calls it. */
export const identityApiOptionsOf = (w: EcommerceWiring): IdentityApiOptions => ({
    url: w.apps.identity.url,
    timeoutMs: CALL_DEADLINE_MS,
})

/** The logical topics of the run: the events, retry and dead-letter topic of each service that publishes (`order`, `billing`) and of the probe the bus integration spec runs. */
export const EVENT_TOPICS: ReadonlyArray<string> = ["order", "billing", "probe"].flatMap((service) => [
    `events.${service}`,
    `events.${service}.retry`,
    `events.${service}.dlq`,
])

/** How the app of `service` reaches the broker of the run: its own consumer group, the topics of the run's prefix, a relay that polls fast. */
export const eventBusOptionsOf = (w: EcommerceWiring, service: string): EventBusConfig => ({
    brokers: w.kafka.brokers,
    groupId: `${w.kafka.topicPrefix}${service}`,
    topicPrefix: w.kafka.topicPrefix,
    relayIntervalMs: 100,
    relayBatch: 50,
    timeoutMs: CALL_DEADLINE_MS,
})

/** The bucket of the run's MinIO that archives the receipts (declared in `stacks.minio.buckets`). */
export const RECEIPTS_BUCKET = "receipts"

/** The receipt archive over the run's own bucket of the stack's MinIO; links live five minutes. */
export const receiptStorageOptionsOf = (w: EcommerceWiring): ReceiptStorageOptions => ({
    endpoint: w.minio.endpoint,
    region: "us-east-1",
    bucket: w.minio.bucket(RECEIPTS_BUCKET),
    accessKeyId: w.minio.accessKey,
    secretAccessKey: new Secret(w.minio.secretKey),
    linkTtlMs: 300_000,
    timeoutMs: CALL_DEADLINE_MS,
})

const httpSecurity: HttpSecurityOptions = {
    allowedOrigins: ALLOWED_ORIGINS,
    rateLimit: { windowMs: 60_000, defaultLimit: RATE_LIMIT_HIGH, strictLimit: RATE_LIMIT_HIGH },
    webhooks: {},
}

/** The value a fake exposes for the app options; a missing one is a declaration mistake the boot must name. */
const fakeValue = (values: Readonly<Record<string, string>>, key: string): string => {
    const value = values[key]
    if (value === undefined) {
        throw new TestWorldError({
            code: TestWorldErrorCode.NotDeclared,
            params: { detail: `the fake exposes no value "${key}"` },
        })
    }
    return value
}

/** The options of the identity app. */
export const identityOptions = (w: EcommerceWiring): IdentityAppOptions => ({
    port: w.apps.identity.port,
    database: identityDatabase(w),
    cache: cacheOptionsOf(w),
    orderApi: orderApiOptionsOf(w),
    keycloak: keycloakOptionsOf(w),
    keycloakAdmin: keycloakAdminOptionsOf(w),
    httpSecurity,
})

/** The options of the order app. */
export const orderOptions = (w: EcommerceWiring): OrderAppOptions => ({
    port: w.apps.order.port,
    database: orderDatabase(w),
    identityApi: identityApiOptionsOf(w),
    eventBus: eventBusOptionsOf(w, "order"),
    receiptStorage: receiptStorageOptionsOf(w),
    httpSecurity,
    queue: queueOptionsOf(w, `order${w.kafka.topicPrefix.replace(/\W/g, "")}`),
    jobs: { workerId: "order-test", leaseMs: 30_000 },
    orderExpiry: { everyMs: ORDER_EXPIRY_TICK_MS, olderThanMs: ORDER_PAYMENT_WINDOW_TEST_MS },
})

/** The largest total the billing worker of the world invoices: small, so a spec can place an order it rejects. */
export const BILLING_LIMIT_MINOR_UNITS = 100_000

/** The replay window of the notifier signature in the world: five minutes, like the deployment default. */
const WEBHOOK_TOLERANCE_MS = 300_000

/** The options of the billing api: the notifier fake signs with the secret the fake exposes, and the app verifies with the same one. */
export const billingOptions = (w: EcommerceWiring): BillingAppOptions => ({
    port: w.apps.billing.port,
    database: billingDatabase(w),
    identityApi: identityApiOptionsOf(w),
    httpSecurity: {
        ...httpSecurity,
        webhooks: {
            sepay: { secret: new Secret(fakeValue(w.fake.sepay.values, "webhookSecret")), toleranceMs: WEBHOOK_TOLERANCE_MS },
        },
    },
    eventBus: eventBusOptionsOf(w, "billing"),
    invoice: { maxTotalMinorUnits: BILLING_LIMIT_MINOR_UNITS },
})

/** The platform base of a modules world: clock, logging and both connections, as the app roots register them. */
export const platformBase = (w: EcommerceWiring): ReadonlyArray<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    HttpModule.register({ isGlobal: true }),
    DatabaseModule.register({
        isGlobal: true,
        connections: [
            { ...identityDatabase(w), entities: IDENTITY_ENTITIES, migrations: [] },
            { ...orderDatabase(w), entities: ORDER_ENTITIES, migrations: [] },
            { ...billingDatabase(w), entities: BILLING_ENTITIES, migrations: [] },
        ],
    }),
]

/** How the queues of `service` reach the run's Redis: a prefix of its own so two runs never share a BullMQ key, a relay that polls fast. */
export const queueOptionsOf = (w: EcommerceWiring, prefix: string): QueueConfig => {
    const address = new URL(w.redis.url)
    return {
        redisHost: address.hostname,
        redisPort: Number(address.port === "" ? "6379" : address.port),
        prefix,
        relayIntervalMs: 100,
        relayBatch: 50,
        concurrency: 2,
    }
}
