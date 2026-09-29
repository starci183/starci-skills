import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** SignIn takes no options beyond the isGlobal extra. */
export type SignInOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SignInOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
