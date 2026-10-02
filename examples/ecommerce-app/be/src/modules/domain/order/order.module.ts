import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CheckoutService } from "./checkout.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./order.module-definition"
import { ReceiptModule } from "@modules/queues/receipt"
import { OrderPaymentService } from "./order-payment.service"
import { OrderStatusService } from "./order-status.service"
import { OrderService } from "./order.service"
import { ReceiptService } from "./receipt.service"

@Module({})
/** The order capability over the order database; the cart, catalog and payment capabilities it uses are registered by the app. */
export class OrderModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), ReceiptModule],
            providers: [
                ...(base.providers ?? []),
                OrderService,
                CheckoutService,
                ReceiptService,
                OrderPaymentService,
                OrderStatusService,
            ],
            exports: [OrderService, CheckoutService, ReceiptService, OrderPaymentService, OrderStatusService],
        }
    }
}
