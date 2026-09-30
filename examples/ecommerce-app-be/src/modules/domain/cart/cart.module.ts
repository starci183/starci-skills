import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./cart.module-definition"
import { CART_SERVICE } from "./cart.decorators"
import { CartService } from "./cart.service"

@Module({})
/** The cart capability over the order database. */
export class CartModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), CartService, { provide: CART_SERVICE, useExisting: CartService }],
            exports: [CART_SERVICE],
        }
    }
}
