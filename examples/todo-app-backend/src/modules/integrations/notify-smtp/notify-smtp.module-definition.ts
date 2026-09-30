import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { NotifySmtpOptions } from "./notify-smtp.options"

/** The configurable-module base of the notify-smtp integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<NotifySmtpOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
