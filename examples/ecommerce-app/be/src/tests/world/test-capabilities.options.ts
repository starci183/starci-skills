/**
 * The capability sets of the order product as module factories for a modules world: the real capability modules an
 * integration spec exercises, registered as the app root registers them (global, with the options of the run). A modules
 * spec spreads a set, or picks factories one by one; the spec itself never writes `isGlobal`.
 */
import type { ModuleFactory } from "@starci/test-world"
import { CatalogModule } from "@modules/domain/catalog"

/** The catalog capability over the order database: stock, reservations. */
export const CATALOG_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    () => CatalogModule.register({ isGlobal: true }),
]
