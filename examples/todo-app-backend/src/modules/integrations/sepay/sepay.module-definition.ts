import { ConfigurableModuleBuilder } from "@nestjs/common"
import { SEPAY_OPTIONS } from "./sepay.decorators"
import type { SepayOptions } from "./sepay.options"

/** The configurable-module base of the SePay integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SepayOptions>({ optionsInjectionToken: SEPAY_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
