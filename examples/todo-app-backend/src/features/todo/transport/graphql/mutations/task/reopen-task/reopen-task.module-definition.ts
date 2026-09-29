import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** ReopenTask takes no options beyond the isGlobal extra. */
export type ReopenTaskOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ReopenTaskOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
