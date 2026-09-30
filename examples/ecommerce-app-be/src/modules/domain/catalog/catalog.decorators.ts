import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { CatalogService } from "./catalog.service"

/** Token of the CatalogService of this capability, for the capabilities that use it. */
export const CATALOG_SERVICE: unique symbol = Symbol("domain.catalog.service")

/** Injects the CatalogService. Parameter type: CatalogService. */
export const InjectCatalogService = (): TypedParameterDecorator<CatalogService> =>
    injector<CatalogService>(CATALOG_SERVICE)
