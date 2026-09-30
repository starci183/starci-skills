import {
import { ModuleKind } from "@modules/platform/composition"
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** NotifySmtp takes no options beyond the isGlobal extra. */
export type NotifySmtpOptions = Record<never, never>

/** See databases/primary.module-definition.ts's comment: same isGlobal knob, every module. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<NotifySmtpOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()

/** How the notify-smtp module is composed: registered once at the app root and reached through injectors. */
export const NOTIFY_SMTP_MODULE_KIND = ModuleKind.Capability
