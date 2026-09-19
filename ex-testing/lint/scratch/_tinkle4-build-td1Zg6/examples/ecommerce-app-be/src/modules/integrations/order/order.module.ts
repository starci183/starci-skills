import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    OrderApiClient 
} from "./order.client"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./order.module-definition"

@Module({
})
/**
 * The `order` integration module: the identity service's real HTTP client toward the order
 * service's internal buyer-status door (the consumer half of
 * contract.checkout.order-for-identity). Its globality is declared at `apps/identity`
 * (`OrderModule.register({ isGlobal: true })`) - the account door reaches the client without
 * importing a capability module.
 */
export class OrderModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                OrderApiClient],
            exports: [OrderApiClient],
        }
    }
}
