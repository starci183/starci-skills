import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** AddCartItem takes no options beyond the isGlobal extra. */
export type AddCartItemOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AddCartItemOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
