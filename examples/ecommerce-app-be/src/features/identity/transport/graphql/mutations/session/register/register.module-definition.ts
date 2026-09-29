import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Register takes no options beyond the isGlobal extra. */
export type RegisterOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<RegisterOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
