import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    CartService 
} from "./cart.service"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./cart.module-definition"

@Module({
})
/**
 * The `cart` capability module: the per-person cart behind the checkout doors. Persistence is the
 * primary EntityManager the order database module registers app-wide at `apps/order`; this
 * module's own globality is declared there too, so the checkout feature never imports a
 * capability.
 */
export class CartModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                CartService],
            exports: [CartService],
        }
    }
}
