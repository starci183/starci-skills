import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WebhookProviderOptions } from "./sepay.options"
import { SEPAY_OPTIONS } from "./sepay.decorators"

/** The configurable-module base of the SePay integration. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<WebhookProviderOptions>({ optionsInjectionToken: SEPAY_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
