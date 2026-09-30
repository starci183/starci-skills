import { ConfigurableModuleBuilder } from "@nestjs/common"
import { ModuleKind } from "@modules/platform/composition"
import type { PaymentOptions } from "./payment.options"

/** The configurable-module base of the payment capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PaymentOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How this module is composed: stateful, registered once per app at the root. */
export const PAYMENT_MODULE_KIND = ModuleKind.Capability
