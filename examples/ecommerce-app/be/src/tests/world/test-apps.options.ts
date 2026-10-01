/**
 * The typed options the test world hands to the real apps, and the platform base of a modules world: what the `main.ts` of
 * each app would parse from the environment of a deployment, built as objects from the wiring of the run. Both databases and
 * the Redis of the cache are the real ones the library runs; each app is wired to the other through the URL the library
 * reserved for it before either booted.
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
import { LoggingModule } from "@modules/platform/logging"
import type { IdentityAppOptions } from "../../../apps/identity/src/identity.options"
import type { OrderAppOptions } from "../../../apps/order/src/order.options"

const RATE_LIMIT_HIGH = 100_000
const CALL_DEADLINE_MS = 5000
const ALLOWED_ORIGINS: ReadonlyArray<string> = ["http://localhost:4069"]

/** The identity app's Keycloak admin target: a loopback discard port nothing listens on (the stack runs no Keycloak), so its sign-up provisioning refuses as unavailable. */
const ABSENT_KEYCLOAK_URL = "http://127.0.0.1:9"

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

const httpSecurity = {
    allowedOrigins: ALLOWED_ORIGINS,
    rateLimit: { windowMs: 60_000, defaultLimit: RATE_LIMIT_HIGH, strictLimit: RATE_LIMIT_HIGH },
}

/** The options of the identity app. */
export const identityOptions = (w: EcommerceWiring): IdentityAppOptions => ({
    port: w.apps.identity.port,
    database: identityDatabase(w),
    cache: { url: new Secret(w.redis.url) },
    orderApi: { url: w.apps.order.url, timeoutMs: CALL_DEADLINE_MS },
    keycloakAdmin: {
        url: ABSENT_KEYCLOAK_URL,
        realm: "world",
        token: new Secret("world-absent"),
        timeoutMs: CALL_DEADLINE_MS,
    },
    httpSecurity,
})

/** The options of the order app. */
export const orderOptions = (w: EcommerceWiring): OrderAppOptions => ({
    port: w.apps.order.port,
    database: orderDatabase(w),
    identityApi: { url: w.apps.identity.url, timeoutMs: CALL_DEADLINE_MS },
    httpSecurity,
})

/** The platform base of a modules world: clock, logging and both connections, as the app roots register them. */
export const platformBase = (w: EcommerceWiring): ReadonlyArray<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    DatabaseModule.register({
        isGlobal: true,
        connections: [
            { ...identityDatabase(w), entities: IDENTITY_ENTITIES, migrations: [] },
            { ...orderDatabase(w), entities: ORDER_ENTITIES, migrations: [] },
        ],
    }),
]
