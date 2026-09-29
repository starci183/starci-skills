import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Account takes no options beyond the isGlobal extra. */
export type AccountOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AccountOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
