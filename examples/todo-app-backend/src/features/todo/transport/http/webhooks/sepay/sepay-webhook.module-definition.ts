import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** SepayWebhook takes no options beyond the isGlobal extra. */
export type SepayWebhookOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SepayWebhookOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
