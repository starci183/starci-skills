/**
 * The capability sets of the order product as module factories for a modules world: the real capability modules an
 * integration spec exercises, registered as the app root registers them (global, with the options of the run). A modules
 * spec spreads a set, or picks factories one by one; the spec itself never writes `isGlobal`.
 */
import type { ModuleFactory } from "@starci/test-world"
import { CatalogModule } from "@modules/domain/catalog"
import { CacheModule } from "@modules/integrations/cache"
import { IdentityApiModule } from "@modules/integrations/identity-api"
import { KeycloakAdminModule } from "@modules/integrations/keycloak-admin"
import { OrderApiModule } from "@modules/integrations/order-api"
import { cacheOptionsOf, identityApiOptionsOf, keycloakAdminOptionsOf, orderApiOptionsOf } from "./test-apps.options"

/** The catalog capability over the order database: stock, reservations. */
export const CATALOG_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    () => CatalogModule.register({ isGlobal: true }),
]

/** The cache client over the run's Redis. */
export const CACHE_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => CacheModule.register({ isGlobal: true, ...cacheOptionsOf(w) }),
]

/** The Keycloak admin client over the run's realm. */
export const KEYCLOAK_ADMIN_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => KeycloakAdminModule.register({ isGlobal: true, ...keycloakAdminOptionsOf(w) }),
]

/** The order api client over the real order app (the world boots it beside the modules). */
export const ORDER_API_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => OrderApiModule.register({ isGlobal: true, ...orderApiOptionsOf(w) }),
]

/** The identity api client over the real identity app (the world boots it beside the modules). */
export const IDENTITY_API_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => IdentityApiModule.register({ isGlobal: true, ...identityApiOptionsOf(w) }),
]
