import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Unsubscribe takes no options beyond the isGlobal extra. */
export type UnsubscribeOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<UnsubscribeOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
