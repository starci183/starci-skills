import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** PlaceOrder takes no options beyond the isGlobal extra. */
export type PlaceOrderOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PlaceOrderOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
