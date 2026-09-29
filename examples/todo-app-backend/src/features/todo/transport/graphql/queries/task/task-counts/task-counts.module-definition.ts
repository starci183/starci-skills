import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** TaskCounts takes no options beyond the isGlobal extra. */
export type TaskCountsOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<TaskCountsOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
