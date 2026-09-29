import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** ClearCart takes no options beyond the isGlobal extra. */
export type ClearCartOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ClearCartOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
