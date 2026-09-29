import {
    ConfigurableModuleBuilder 
} from "@nestjs/common"

/** EndRecurrence takes no options beyond the isGlobal extra. */
export type EndRecurrenceOptions = Record<never, never>

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<EndRecurrenceOptions>().setExtras(
    {
        isGlobal: false 
    },
    (definition, extras) => ({
        ...definition, global: extras.isGlobal 
    }),
).build()
