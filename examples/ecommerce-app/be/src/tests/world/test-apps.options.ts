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
import { orderEntities } from "@modules/domain/order"
import { paymentEntities } from "@modules/domain/payment"
import { ClockModule } from "@modules/platform/clock"
import { EnvSource, Secret } from "@modules/platform/config"
import { DatabaseModule, parseIdentityDatabaseConfig, parseOrderDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionConfig, DatabaseConnectionOptions } from "@modules/platform/database"
import { HttpModule } from "@modules/platform/http"
import { LoggingModule } from "@modules/platform/logging"
import type { CacheOptions } from "@modules/integrations/cache"
import type { IdentityApiOptions } from "@modules/integrations/identity-api"
import type { KeycloakAdminOptions } from "@modules/integrations/keycloak-admin"
import type { OrderApiOptions } from "@modules/integrations/order-api"
import type { IdentityAppOptions } from "../../../apps/identity/src/identity.options"
import type { OrderAppOptions } from "../../../apps/order/src/order.options"

const RATE_LIMIT_HIGH = 100_000
const CALL_DEADLINE_MS = 5000
const ALLOWED_ORIGINS: ReadonlyArray<string> = ["http://localhost:4069"]

/** The confidential client of the realm whose service account reads the members (realm-ecommerce.json). */
export const KEYCLOAK_ADMIN_CLIENT = "identity-admin"

/** The wiring of the ecommerce world: its two apps and its two connections. */
export type EcommerceWiring = WorldWiring<"identity" | "order", "identity" | "order">

/** The entities the identity connection maps. */
export const IDENTITY_ENTITIES: DatabaseConnectionOptions["entities"] = accountEntities

/** The entities the order connection maps. */
export const ORDER_ENTITIES: DatabaseConnectionOptions["entities"] = [
    ...catalogEntities,
    ...cartEntities,
    ...orderEntities,
    ...paymentEntities,
]

/** The identity connection of the run, read the way the identity app's `main.ts` reads its environment. */
const identityDatabase = (w: EcommerceWiring): DatabaseConnectionConfig =>
    parseIdentityDatabaseConfig(new EnvSource({ IDENTITY_DB_URL: w.db.identity.url }))

/** The order connection of the run, read the way the order app's `main.ts` reads its environment. */
const orderDatabase = (w: EcommerceWiring): DatabaseConnectionConfig =>
    parseOrderDatabaseConfig(new EnvSource({ ORDER_DB_URL: w.db.order.url }))

/** The Redis of the run, the store of the identity app's cache. */
export const cacheOptionsOf = (w: EcommerceWiring): CacheOptions => ({ url: new Secret(w.redis.url) })

/** The realm of the run, read through the service account of the confidential admin client. */
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
    keycloakAdmin: keycloakAdminOptionsOf(w),
    httpSecurity,
})

/** The options of the order app. */
export const orderOptions = (w: EcommerceWiring): OrderAppOptions => ({
    port: w.apps.order.port,
    database: orderDatabase(w),
    identityApi: identityApiOptionsOf(w),
    httpSecurity,
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
        ],
    }),
]
