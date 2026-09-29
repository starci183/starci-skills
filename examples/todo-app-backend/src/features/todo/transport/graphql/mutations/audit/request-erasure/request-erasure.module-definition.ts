import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** RequestErasure takes no options beyond the isGlobal extra. */
export type RequestErasureOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<RequestErasureOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
