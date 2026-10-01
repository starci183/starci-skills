import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PaymentOptions } from "./payment.options"

/** The configurable-module base of the payment capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PaymentOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
