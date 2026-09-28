import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    CheckoutPolicy 
} from "./checkout.policy"
import {
    OrderService 
} from "./order.service"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./order.module-definition"

@Module({
})
/**
 * The `order` capability module: the confirmation of sds.checkout.order-flow - the policy, the
 * transaction and the buyer-status answer. It declares no imports: OrderService's collaborators
 * (cart, catalog, payment) are the sibling capability modules `apps/order` registers app-wide,
 * and its persistence is the same global primary EntityManager. This module's own globality is
 * declared at `apps/order` too, so the checkout feature never imports a capability.
 */
export class OrderModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                OrderService,
                CheckoutPolicy],
            exports: [OrderService],
        }
    }
}
