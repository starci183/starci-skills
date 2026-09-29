import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** SignOut takes no options beyond the isGlobal extra. */
export type SignOutOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SignOutOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
