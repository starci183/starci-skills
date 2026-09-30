import {
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
