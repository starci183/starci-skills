import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Cart takes no options beyond the isGlobal extra. */
export type CartOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CartOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
