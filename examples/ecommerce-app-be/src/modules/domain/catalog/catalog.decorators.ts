import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { CatalogService } from "./catalog.service"

/** Injects the CatalogService of this capability. Parameter type: CatalogService. */
export const InjectCatalogService = (): TypedParameterDecorator<CatalogService> => injector<CatalogService>(CatalogService)
