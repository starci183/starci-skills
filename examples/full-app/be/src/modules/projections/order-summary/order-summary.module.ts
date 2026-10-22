import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./order-summary.module-definition"
import { OrderSummaryProjection } from "./order-summary.projection"

@Module({})
/** The order-summary projection over the order database; its table is created by the migrations the app registers. */
export class OrderSummaryModule extends ConfigurableModuleClass {
    /** Registers the projection once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), OrderSummaryProjection],
            exports: [OrderSummaryProjection],
        }
    }
}
