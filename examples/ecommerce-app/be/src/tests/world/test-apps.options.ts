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
import { orderEntities } from "@modules/domain/order"
import { paymentEntities } from "@modules/domain/payment"
import { ClockModule } from "@modules/platform/clock"
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
import type { MessagingOptions } from "@modules/integrations/messaging"
import { LoggingModule } from "@modules/platform/logging"
import type { CacheOptions } from "@modules/integrations/cache"
import type { IdentityApiOptions } from "@modules/integrations/identity-api"
import type { KeycloakOptions } from "@modules/integrations/keycloak"
import type { KeycloakAdminOptions } from "@modules/integrations/keycloak-admin"
import type { OrderApiOptions } from "@modules/integrations/order-api"
import type { ReceiptStorageOptions } from "@modules/integrations/receipt-storage"
import type { BillingAppOptions } from "../../../apps/billing/src/billing.options"
import type { IdentityAppOptions } from "../../../apps/identity/src/identity.options"
import type { OrderAppOptions } from "../../../apps/order/src/order.options"

const RATE_LIMIT_HIGH = 100_000
const CALL_DEADLINE_MS = 5000
const ALLOWED_ORIGINS: ReadonlyArray<string> = ["http://localhost:4069"]

/** The public client of the realm shoppers sign in through with the password grant (realm-ecommerce.json). */
export const KEYCLOAK_SIGN_IN_CLIENT = "identity-api"

/** The confidential client of the realm whose service account creates the shoppers (realm-ecommerce.json). */
export const KEYCLOAK_ADMIN_CLIENT = "identity-admin"

/** The wiring of the ecommerce world: its three apps and their three connections. */
export type EcommerceWiring = WorldWiring<"identity" | "order" | "billing", "identity" | "order" | "billing">

/** The entities the identity connection maps. */
export const IDENTITY_ENTITIES: DatabaseConnectionOptions["entities"] = accountEntities

/** The entities the order connection maps. */
export const ORDER_ENTITIES: DatabaseConnectionOptions["entities"] = [
    ...catalogEntities,
    ...cartEntities,
    ...orderEntities,
    ...paymentEntities,
]

/** The entities the billing connection maps. */
export const BILLING_ENTITIES: DatabaseConnectionOptions["entities"] = [...invoiceEntities, ...inboxEntities]

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

/** The Redis queues of the run, on the run's own Redis DB, shared by the publishers and the workers of every app. */
export const messagingOptionsOf = (w: EcommerceWiring): MessagingOptions => ({
    url: new Secret(w.redis.url),
    timeoutMs: CALL_DEADLINE_MS,
    concurrency: 1,
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

const httpSecurity = {
    allowedOrigins: ALLOWED_ORIGINS,
    rateLimit: { windowMs: 60_000, defaultLimit: RATE_LIMIT_HIGH, strictLimit: RATE_LIMIT_HIGH },
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
    messaging: messagingOptionsOf(w),
    receiptStorage: receiptStorageOptionsOf(w),
    httpSecurity,
})

/** The largest total the billing worker of the world invoices: small, so a spec can place an order it rejects. */
export const BILLING_LIMIT_MINOR_UNITS = 100_000

/** The options of the billing worker. */
export const billingOptions = (w: EcommerceWiring): BillingAppOptions => ({
    database: billingDatabase(w),
    messaging: messagingOptionsOf(w),
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
