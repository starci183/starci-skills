import type { DynamicModule } from "@nestjs/common"
import { CartModule } from "@modules/domain/cart"
import { CatalogModule } from "@modules/domain/catalog"
import { IdentityModule } from "@modules/domain/identity"
import { LoyaltyModule } from "@modules/domain/loyalty"
import { OrderModule } from "@modules/domain/order"
import { IDENTITY_API, IdentityApiModule } from "@modules/integrations/identity-api"
import { ReceiptStorageModule } from "@modules/integrations/receipt-storage"
import { OrderSummaryModule } from "@modules/projections/order-summary"
import type { OrderAppOptions } from "../order.options"

/** The order capabilities bind their identity verifier, receipt storage and summary projection once, app-wide. */
export const domainModules = (options: OrderAppOptions): Array<DynamicModule> => [
    IdentityApiModule.register({ isGlobal: true, ...options.identityApi }),
    ReceiptStorageModule.register({ isGlobal: true, ...options.receiptStorage }),
    CatalogModule.register({ isGlobal: true }),
    CartModule.register({ isGlobal: true }),
    LoyaltyModule.register({ isGlobal: true }),
    OrderSummaryModule.register({ isGlobal: true }),
    OrderModule.register({ isGlobal: true }),
    IdentityModule.register({ isGlobal: true, verifier: IDENTITY_API }),
]
