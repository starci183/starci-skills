import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./payment.module-definition"
import { PAYMENT_SERVICE } from "./payment.decorators"
import { PaymentService } from "./payment.service"

@Module({})
/** The payment capability over the order database. */
export class PaymentModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                PaymentService,
                { provide: PAYMENT_SERVICE, useExisting: PaymentService },
            ],
            exports: [PAYMENT_SERVICE],
        }
    }
}
