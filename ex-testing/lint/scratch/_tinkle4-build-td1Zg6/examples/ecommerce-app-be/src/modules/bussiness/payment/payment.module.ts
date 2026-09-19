import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    PaymentService 
} from "./payment.service"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./payment.module-definition"

@Module({
})
/**
 * The `payment` capability module: the internal capture ledger the checkout transaction writes
 * inside its own EntityManager transaction. This module's globality is declared at `apps/order`
 * (`PaymentModule.register({ isGlobal: true })`), so no feature imports a capability.
 */
export class PaymentModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                PaymentService],
            exports: [PaymentService],
        }
    }
}
