import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** ListTasks takes no options beyond the isGlobal extra. */
export type ListTasksOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ListTasksOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
