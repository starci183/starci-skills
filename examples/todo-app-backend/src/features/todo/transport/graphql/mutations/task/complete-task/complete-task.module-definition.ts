import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** CompleteTask takes no options beyond the isGlobal extra. */
export type CompleteTaskOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CompleteTaskOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
