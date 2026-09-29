import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** Probes takes no options beyond the isGlobal extra. */
export type ProbesOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ProbesOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
