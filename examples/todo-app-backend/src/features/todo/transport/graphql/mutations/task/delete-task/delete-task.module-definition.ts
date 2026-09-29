import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** DeleteTask takes no options beyond the isGlobal extra. */
export type DeleteTaskOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DeleteTaskOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
