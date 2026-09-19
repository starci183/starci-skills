import {
    Module 
} from "@nestjs/common"
import {
    BuyerController 
} from "./transport/http/buyer.controller"
import {
    HealthController 
} from "./transport/http/health.controller"

@Module({
    controllers: [BuyerController,
        HealthController],
})
/**
 * The checkout feature of apps/order - the HTTP transport that stays HTTP for a sanctioned
 * reason: the internal buyer surface identity reads buyer status through (a machine-to-machine
 * door) and /health (a probe). The user-facing JSON API - cart, addCartItem, clearCart,
 * placeOrder - now lives in the canonical GraphQL transport under features/checkout/graphql,
 * guarded there by the same session verification. Thin on purpose and import-free: the
 * capability modules (cart, catalog, order, payment, the identity integration) and the
 * platform modules are all registered app-wide at the `apps/order` composition root, so this
 * module only mounts controllers - a feature never imports a capability module.
 */
export class CheckoutModule {}
