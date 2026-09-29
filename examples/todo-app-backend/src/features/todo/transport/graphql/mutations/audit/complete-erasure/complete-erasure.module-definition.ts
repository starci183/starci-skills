import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** CompleteErasure takes no options beyond the isGlobal extra. */
export type CompleteErasureOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CompleteErasureOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
