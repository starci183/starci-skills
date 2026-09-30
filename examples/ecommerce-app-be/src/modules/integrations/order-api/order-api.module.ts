import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { OrderApiClient } from "./order-api.client"
import { ORDER_API } from "./order-api.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./order-api.module-definition"

@Module({})
/** Provides the order api client. */
export class OrderApiModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls the order service. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: ORDER_API, useClass: OrderApiClient }],
            exports: [ORDER_API],
        }
    }
}
