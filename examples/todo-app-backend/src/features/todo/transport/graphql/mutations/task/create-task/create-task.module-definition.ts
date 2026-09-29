import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** CreateTask takes no options beyond the isGlobal extra. */
export type CreateTaskOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CreateTaskOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
