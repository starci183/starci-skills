import { ConfigurableModuleBuilder } from "@nestjs/common"
import { ORDER_EXPIRY_TICKS_OPTIONS } from "./order-expiry-ticks.decorators"
import type { OrderExpiryTicksOptions } from "./order-expiry-ticks.options"

/** The manual expiry capability configuration; the app decides globality. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrderExpiryTicksOptions>({
    optionsInjectionToken: ORDER_EXPIRY_TICKS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
